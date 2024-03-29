﻿(function ($, Mustache) {
    $.support.cors = true;

    var advertiseController = {
        config: {
            page: (typeof window.pageAdCode == 'undefined') ? null : window.pageAdCode,
            urls: {
                getAds: 'https://ads.farakav.com/group/'
            },
            templates: {
                ad: '#AdvertiseTemplate'
            },
            cookie: {
                rotateListFirst: 'FirstAd'
            },
            requests: {
                count: 0, // every time sends an ajax request to server, increases it by one. this would be used upon failurs
                limit: 3,
                delay: 10000 // miliseconds to delayed upon ajax failure
            }
        },
        populateAdsGroup: function (adsGroup, key) {
            var $targetContainer = $('.ad-container[data-adposition="' + key + '"]');
            return $.map(adsGroup[key], function (item) {
                if (item.IsNative) {
                    item.Class += ' is-native';
                    item.Title = item.Title || '';

                    item.ShowProviderBadge = $targetContainer.data('noProviderBadge') !== 'yes';
                } else if (item.Provider) {
                    item.ShowProviderBadge = true;

                    // todo: should become available in the server response
                    switch (item.Provider) {
                        case 'fastclick':
                            item.ProviderUrl = 'http://fastclick.ir';
                            break;
                        default:
                            item.ProviderUrl = '#';
                    }
                }

                // LoadInIframe
                // ------------------------------------------
                //item.LoadInIframe = !item.IsNative && item.Location === 'C0' && item.index > 5 || item.Location == 'C1' && item.index > 5 || item.Location == 'B2';
                //if (item.LoadInIframe) {
                //    item.Url = escape(item.Url);
                //}

                return item;
            });
        },
        getAdsFromServer: function (callback) {
            if (this.config.page === null) {
                return false;
            }

            var url = this.config.urls.getAds;
            url += this.config.page;

            var data = {
                uid: $.cookie('_uid') || ''
            };

            $.ajax({
                type: 'get',
                url: url,
                data: data,
                contentType: 'text/plain',
                dataType: 'json',
                success: function (response) {
                    var jsonData = {};

                    if (typeof response != 'object') { // is string
                        jsonData = JSON.parse(response);
                    }
                    else { // is json object
                        jsonData = response;
                    }

                    callback(true, jsonData);
                },
                error: function (a, b, c) {
                    callback(false);
                }
            });
        },
        // changes [1,2,3,4] to [2,3,4,1]
        rotateByOne: function (array) {
            return array.push(array.shift());
        },
        cookie: {
            getCookieByName: function (name) {
                var nameEQ = name + '=';
                var ca = document.cookie.split(';');

                for (var i = 0; i < ca.length; i++) {
                    var c = ca[i];
                    while (c.charAt(0) == ' ') c = c.substring(1, c.length);
                    if (c.indexOf(nameEQ) === 0) {
                        var cookieValue = c.substring(nameEQ.length, c.length);

                        try {
                            return JSON.parse(cookieValue);
                        }
                        catch (e) {
                            return {};
                        }
                    }
                }

                return {};
            },
            setCookieByName: function (name, value) {
                // set addDays prototype to Date
                Date.prototype.addDays = function (days) {
                    var dat = new Date(this.valueOf());
                    dat.setDate(dat.getDate() + days);
                    return dat;
                };

                var cookieValue = '{name}={value}; expires={datetime}; path=/';
                var dateTime = new Date();
                // add 20 days to expiration datetime
                dateTime = dateTime.addDays(20);

                cookieValue = cookieValue
                                .replace(/{name}/, name)
                                .replace(/{value}/, value)
                                .replace(/{datetime}/, dateTime);

                document.cookie = cookieValue;
            }
        },
        // returns string which contains cookie name
        getRotateCookieName: function () {
            return this.config.cookie.rotateListFirst;
        },
        /*
            assume adsArray is [100,110,120,130]
            last time, first ad was 120
            so adsArray would be change to [130,100,110,120]

            also sets first ad id to cookie
        */
        orderRotatingArray: function (adsArray, adGroupId, shouldRandomizeRoll) {
            var i = 0;
            var cookieName = this.getRotateCookieName();
            var cookieValue = this.cookie.getCookieByName(cookieName);

            if(shouldRandomizeRoll)
            // if should randomize, then do it
            if (adsArray.length > 1 && shouldRandomizeRoll) {
                var randomNumber = Math.floor(Math.random() * adsArray.length);

                for (i = 0; i < randomNumber; i++)
                    this.rotateByOne(adsArray);
            }

            // get first ad id
            var firstAdId = (typeof cookieValue[adGroupId] !== 'undefined') ? cookieValue[adGroupId] : null;

            // if there is any cookie
            if (firstAdId !== null) {
                // iterate over array and rotate it by one until last first ad goes to last
                for (i = 0; i < adsArray.length && adsArray[adsArray.length - 1].Id != firstAdId ; i++) {
                    this.rotateByOne(adsArray);
                }
            }

            if (adsArray.length > 0)
                firstAdId = adsArray[0].Id;

            // set current group's first ad id to array's first child
            cookieValue[adGroupId] = firstAdId;

            // set first ad id to cookie
            this.cookie.setCookieByName(cookieName, JSON.stringify(cookieValue));

            return adsArray;
        },
        // gets array of ads and orders unfixed values and concats them to array like this [fixed, fixed, ...., fixed, unfixed, unfixed, unfixed, unfixed, ...]
        concatFixedAndOrderedRotationalAds: function (adsArray, adGroupId, shouldRandomizeRoll) {
            var i = 0;
            var fixedAds = [];
            var unfixedAds = [];

            // iterate over array and set Id to each object. also push each one to fixed/unfixed array
            for (i = 0; i < adsArray.length; i++) {
                // set Id property to object
                adsArray[i].Id = adsArray[i].FileName.split('.')[0];

                adsArray[i].IsFlash = (adsArray[i].FileType == 'swf') ? true : false;

                adsArray[i].Class = 'ad';

                if (window.adPageName === 'newspaper') {
                    adsArray[i].Class = 'newspaper-ad';
                }

                // append class name from dom to item
                adsArray[i].Class += ' ' + $('[data-adposition="' + adsArray[i].AdPosition + '"]').data('className');

                if (adsArray[i].AdFix)
                    fixedAds.push(adsArray[i]);
                else
                    unfixedAds.push(adsArray[i]);
            }

            unfixedAds = this.orderRotatingArray(unfixedAds, adGroupId, shouldRandomizeRoll);

            // sort fixed ads
            fixedAds.sort(function (a, b) {
                if (a.AdFix < b.AdFix) {
                    return 1;
                }
                else if (a.AdFix > b.AdFix) {
                    return -1;
                }

                return 0;
            });


            var concatenatedAds = fixedAds.concat(unfixedAds);

            // set INDEX on URLs to make tracking easy
            for (i = 0; i < concatenatedAds.length; i++) {
                concatenatedAds[i].Url += '&lc=';
                concatenatedAds[i].Url += i;
            }

            return concatenatedAds;
        },
        groupAds: function (adsArray) {
            var ads = {};

            for (var i = 0; i < adsArray.length; i++) {
                var currentAd = adsArray[i];
                var adPosition = currentAd.AdPosition;

                if (typeof ads[adPosition] == 'undefined')
                    ads[adPosition] = [];

                ads[adPosition].push(currentAd);
            }

            return ads;
        },
        removeEmptyAdsWrappers: function () {
            var $adsWrappers = $('.ads-wrapper');

            $adsWrappers.each(function (index, item) {
                var $item = $(item);
                var $adContainer = $item.find('.ad-container');
                if ($adContainer.length === 0 || ($adContainer.length > 0 && $.trim($adContainer.html()).length === 0)) {
                    $item.remove();
                }
            });
        },
        // this function recieves a flat array and groups all ads. After that, it orders each group and returns grouped object
        processAds: function (adsArray) {
            var self = this;
            var templateIdentifier = this.config.templates.ad;
            var template = $(templateIdentifier).html();

            var cookieName = this.getRotateCookieName();
            var cookieValue = this.cookie.getCookieByName(cookieName);

            // check if has no previous cookie, should randomize ad roll
            var shouldRandomizeRoll = JSON.stringify(cookieValue) == JSON.stringify({});

            // group ads
            var groupedAds = this.groupAds(adsArray);

            // get native ads containers
            var nativeAdsContainers = $('[data-native-ads="yes"]').map(function (index, item) {
                return $(item).data('adposition');
            }).toArray();

            // order ads
            for (var key in groupedAds) {
                // get the container element
                var $targetContainer = $('.ad-container[data-adposition="' + key + '"]');
                var maxItemsCount = $targetContainer.data('maxItemsCount') || Infinity;

                groupedAds[key] = self.concatFixedAndOrderedRotationalAds(groupedAds[key], key, shouldRandomizeRoll);

                // ----- now current group is ordered -----
                for (var i in groupedAds[key]) {
                    groupedAds[key][i].index = i;
                }

                var data = {
                    Data: advertiseController.populateAdsGroup(groupedAds, key).slice(0, maxItemsCount),
                    showHeight: function () {
                        if (this.Location == 'E1') {
                            return false;
                        }

                        return true;
                    }
                };
                data.HasNative = $targetContainer.data('native-ads') === 'yes';

                // render it
                var rendered = Mustache.render(template, data);

                // place it in the container
                $targetContainer.html(rendered);

                $('body').trigger('ad-placed', {
                    key: key,
                    container: $targetContainer
                });
            }
        },
        loadAndRenderAds: function () {
            var self = this;
            // increase requests count by one
            self.config.requests.count++;

            this.getAdsFromServer(function (isSucceed, response) {
                if (isSucceed) {
                    self.processAds(response);

                    $('body').trigger('f-ads-loaded', { ads: response });
                    self.removeEmptyAdsWrappers();
                } else {
                    if (++self.config.requests.count < self.config.requests.limit) {
                        setTimeout(function () {
                            self.loadAndRenderAds();
                        }, self.config.requests.delay);
                    }
                    else {
                        $('.ad-container').remove();
                        console.error('Failed over ' + self.config.requests.count + ' time of Ad API call');
                    }
                }
            });
        }
    };

    if (!window.handleAdsManually) {
        advertiseController.loadAndRenderAds();
    }

    window.advertiseController = advertiseController;
})(jQuery, Mustache);

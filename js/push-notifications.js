var PushNotifications = (function () {
  let applicationServerPublicKey
  const baseUrl = 'https://venom.farakav.com/'
  const token = localStorage.getItem('token')
  let pushServiceWorkerRegistration

  function urlB64ToUint8Array (base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding).replace(/\-/g, '+').replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }

    return outputArray
  }


  function registerPushServiceWorker () {
    navigator.serviceWorker.register('/assets/js/push-notification/service-workers/push-service-worker18.js',
      {scope: '/assets/js/push-notification/service-workers/push-service-worker/'})
      .then(function (serviceWorkerRegistration) {
        pushServiceWorkerRegistration = serviceWorkerRegistration
        subscribeForPushNotifications()
        console.log('Push Service Worker has been registered successfully')
      }).catch(function (error) {
      console.log('Push Service Worker registration has failed: ' + error)
      })
  }

  function subscribeForPushNotifications () {
    if (applicationServerPublicKey) {
      subscribeForPushNotificationsInternal()
    } else {
      fetch(baseUrl + 'v0.1/subscriptions/public-key')
        .then(function (response) {
          if (response.ok) {
            return response.text()
          } else {
            console.log('Failed to retrieve Public Key')
          }
        }).then(function (applicationServerPublicKeyBase64) {
          applicationServerPublicKey = urlB64ToUint8Array(applicationServerPublicKeyBase64)
          console.log('Successfully retrieved Public Key')
          subscribeForPushNotificationsInternal()
        }).catch(function () {
        console.log('Failed to retrieve Public Key: ' + error)
        })
    }
  }

  function subscribeForPushNotificationsInternal () {
    pushServiceWorkerRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerPublicKey
    })
      .then(function (pushSubscription) {
        var tags = []
        var pushData = {
          subscription: pushSubscription,
          tags: tags
        }

        fetch(baseUrl + 'v0.1/subscriptions', {
          method: 'POST',
          headers: {'Content-Type': 'application/json'},
          body: JSON.stringify(pushData)
        })
          .then(function (response) {
            if (response.ok) {
              return response.text()
              console.log('Successfully subscribed for Push Notifications')
            } else {
              unsubscribeFromPushNotifications()
              console.log('Failed to store the Push Notifications subscrition on server')
            }
          }).catch(function () {
            unsubscribeFromPushNotifications()
            console.log('Failed to store the Push Notifications subscrition on server: ' + error)
          })
      }).catch(function () {
        if (Notification.permission !== 'denied') {
          console.log('Failed to subscribe for Push Notifications: ' + error)
        }
      })
  }

  function unsubscribeFromPushNotifications () {
    pushServiceWorkerRegistration.pushManager.getSubscription()
      .then(function (pushSubscription) {
        if (pushSubscription) {
          pushSubscription.unsubscribe()
            console.log('Unsubscribe')
        }
      })
  }

  return {
    initialize: function () {
      if (!'serviceWorker' in navigator) {
        return
      }

      if (!'PushManager' in window) {
        return
      }
      // if the user has granted access before
      if (Notification.permission === 'granted') {
        return
      }
      registerPushServiceWorker()
    }
  }
})()

PushNotifications.initialize()

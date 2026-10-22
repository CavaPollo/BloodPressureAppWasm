// BloodPressureAppWasm - Notification/Reminder System
// Handles browser notifications for medication reminders

function setReminderNotification(therapyName, dosage, delayMs, therapyId) {
    setTimeout(() => {
        if (Notification.permission === "granted") {
            const notification = new Notification("Promemoria Terapia", {
                body: `È ora di prendere: ${therapyName} - ${dosage}`,
                icon: "/icon-192.png",
                badge: "/icon-192.png",
                tag: `therapy-${therapyId}`,
                requireInteraction: true,
                data: {
                    therapyId: therapyId,
                    therapyName: therapyName
                }
            });

            notification.onclick = function() {
                window.focus();
                notification.close();
            };
        }
    }, delayMs);
}

// Request notification permission on page load
document.addEventListener('DOMContentLoaded', function() {
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().then(function(permission) {
            console.log('Notification permission:', permission);
        });
    }
});

// Register service worker for background notifications
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/service-worker.js')
        .then(function(registration) {
            console.log('Service Worker registered:', registration.scope);
        })
        .catch(function(error) {
            console.log('Service Worker registration failed:', error);
        });
}
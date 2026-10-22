using Microsoft.JSInterop;
using System.Text.Json;
using System.Net.Http.Json;

namespace BloodPressureAppWasm.Services;

public class PushNotificationService
{
    private readonly IJSRuntime _jsRuntime;
    private readonly IHttpClientFactory _httpClientFactory;
    private const string VAPID_PUBLIC_KEY = "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE0ASXi9Q2TllApOHO19_hwJqJb5qSX8wJ67Fl4xmLCJw_xCyWmysIynboZGic_0qn8ZNhTks4UGp76JT04pcr5w";

    public PushNotificationService(IJSRuntime jsRuntime, IHttpClientFactory httpClientFactory)
    {
        _jsRuntime = jsRuntime;
        _httpClientFactory = httpClientFactory;
    }

    /// <summary>
    /// Inizializza le notifiche push: richiede permessi, registra subscription, invia al server
    /// </summary>
    public async Task<bool> InitializeAsync()
    {
        try
        {
            // Verifica supporto Service Worker e Push API
            var supported = await _jsRuntime.InvokeAsync<bool>("pushNotifications.isSupported");
            if (!supported)
            {
                Console.WriteLine("Push API non supportata su questo browser");
                return false;
            }

            // Richiedi permessi notifiche
            var permission = await _jsRuntime.InvokeAsync<string>("Notification.requestPermission");
            if (permission != "granted")
            {
                Console.WriteLine("Permessi notifiche negati");
                return false;
            }

            // Registra Service Worker e sottoscrivi a Push
            var subscription = await _jsRuntime.InvokeAsync<PushSubscription?>("pushNotifications.subscribe", VAPID_PUBLIC_KEY);
            if (subscription == null)
            {
                Console.WriteLine("Impossibile creare subscription push");
                return false;
            }

            // Invia subscription al server
            await SendSubscriptionToServerAsync(subscription);

            Console.WriteLine("Push notifications inizializzate correttamente");
            return true;
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Errore inizializzazione push: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Programma una notifica locale (fallback quando server push non disponibile)
    /// Usa Service Worker per persistere anche a tab chiusa
    /// </summary>
    public async Task ScheduleLocalNotificationAsync(string therapyName, string dosage, long delayMs, string therapyId)
    {
        try
        {
            await _jsRuntime.InvokeVoidAsync("pushNotifications.scheduleLocal", new
            {
                therapyName,
                dosage,
                delay = delayMs,
                therapyId
            });
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Errore scheduling notifica locale: {ex.Message}");
        }
    }

    /// <summary>
    /// Annulla una notifica programmata
    /// </summary>
    public async Task CancelNotificationAsync(string therapyId)
    {
        try
        {
            await _jsRuntime.InvokeVoidAsync("pushNotifications.cancel", therapyId);
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Errore cancellazione notifica: {ex.Message}");
        }
    }

    /// <summary>
    /// Invia la subscription push al backend
    /// </summary>
    private async Task SendSubscriptionToServerAsync(PushSubscription subscription)
    {
        try
        {
            var client = _httpClientFactory.CreateClient("Api");
            var response = await client.PostAsJsonAsync("api/push/subscribe", subscription);

            if (!response.IsSuccessStatusCode)
            {
                Console.WriteLine($"Errore invio subscription: {response.StatusCode}");
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Errore connessione server per subscription: {ex.Message}");
            // Salva localmente per retry successivo
            await SaveSubscriptionLocallyAsync(subscription);
        }
    }

    /// <summary>
    /// Salva subscription in localStorage per retry quando online
    /// </summary>
    private async Task SaveSubscriptionLocallyAsync(PushSubscription subscription)
    {
        try
        {
            await _jsRuntime.InvokeVoidAsync("localStorage.setItem", "pushSubscription", JsonSerializer.Serialize(subscription));
        }
        catch { }
    }

    /// <summary>
    /// Tenta di inviare subscription salvate localmente quando si torna online
    /// </summary>
    public async Task RetryPendingSubscriptionsAsync()
    {
        try
        {
            var json = await _jsRuntime.InvokeAsync<string>("localStorage.getItem", "pushSubscription");
            if (!string.IsNullOrEmpty(json))
            {
                var subscription = JsonSerializer.Deserialize<PushSubscription>(json);
                if (subscription != null)
                {
                    await SendSubscriptionToServerAsync(subscription);
                    await _jsRuntime.InvokeVoidAsync("localStorage.removeItem", "pushSubscription");
                }
            }
        }
        catch { }
    }
}

public class PushSubscription
{
    public string Endpoint { get; set; } = "";
    public PushSubscriptionKeys Keys { get; set; } = new();
    public DateTime? ExpirationTime { get; set; }
}

public class PushSubscriptionKeys
{
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";
}
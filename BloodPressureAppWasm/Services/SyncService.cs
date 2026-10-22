using Blazored.LocalStorage;
using System.Net.Http.Json;

namespace BloodPressureAppWasm.Services;

public class SyncService
{
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILocalStorageService _localStorage;
    private const string OfflineQueueKey = "offline_bloodpressure_queue";
    private bool _isSyncing = false;

    public SyncService(IHttpClientFactory httpClientFactory, ILocalStorageService localStorage)
    {
        _httpClientFactory = httpClientFactory;
        _localStorage = localStorage;
    }

    public async Task EnqueueMeasurementAsync(BloodPressureAppLibrary.BloodPressure measurement)
    {
        var queue = await _localStorage.GetItemAsync<List<BloodPressureAppLibrary.BloodPressure>>(OfflineQueueKey)
                    ?? new List<BloodPressureAppLibrary.BloodPressure>();

        queue.Add(measurement);
        await _localStorage.SetItemAsync(OfflineQueueKey, queue);
    }

    public async Task<List<BloodPressureAppLibrary.BloodPressure>> GetOfflineQueueAsync()
    {
        return await _localStorage.GetItemAsync<List<BloodPressureAppLibrary.BloodPressure>>(OfflineQueueKey)
               ?? new List<BloodPressureAppLibrary.BloodPressure>();
    }

    public async Task<bool> SyncPendingDataAsync()
    {
        if (_isSyncing) return false;

        var queue = await GetOfflineQueueAsync();
        if (queue == null || !queue.Any()) return true;

        _isSyncing = true;
        try
        {
            var client = _httpClientFactory.CreateClient("Api");
            var successfullySynced = new List<BloodPressureAppLibrary.BloodPressure>();

            foreach (var item in queue)
            {
                try
                {
                    var response = await client.PostAsJsonAsync("api/bloodpressure", item);
                    if (response.IsSuccessStatusCode)
                    {
                        successfullySynced.Add(item);
                    }
                    else
                    {
                        // Se il server rifiuta per qualche motivo logico, interrompiamo o saltiamo
                        break;
                    }
                }
                catch
                {
                    // Ancora offline o errore di rete, interrompiamo il ciclo di sync
                    break;
                }
            }

            if (successfullySynced.Any())
            {
                foreach (var synced in successfullySynced)
                {
                    queue.Remove(synced);
                }
                await _localStorage.SetItemAsync(OfflineQueueKey, queue);
            }

            return !queue.Any();
        }
        finally
        {
            _isSyncing = false;
        }
    }
}

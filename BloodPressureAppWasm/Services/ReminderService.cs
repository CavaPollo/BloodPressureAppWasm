using Blazored.LocalStorage;
using BloodPressureAppLibrary;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http.Json;
using System.Threading.Tasks;

namespace BloodPressureAppWasm.Services
{
    public class ReminderService
    {
        private readonly ILocalStorageService _localStorage;
        private const string TherapiesKey = "offline_therapies_queue";
        private bool _isSyncing = false;

        public ReminderService(ILocalStorageService localStorage)
        {
            _localStorage = localStorage;
        }

        public async Task<List<Therapy>> GetTherapiesAsync()
        {
            var therapies = await _localStorage.GetItemAsync<List<Therapy>>(TherapiesKey);
            return therapies ?? new List<Therapy>();
        }

        public async Task EnqueueTherapyAsync(Therapy therapy)
        {
            var queue = await _localStorage.GetItemAsync<List<Therapy>>(TherapiesKey)
                        ?? new List<Therapy>();

            // Avoid duplicates by checking if therapy with same name already exists
            if (!queue.Any(t => t.Name == therapy.Name && t.PatientId == therapy.PatientId))
            {
                queue.Add(therapy);
                await _localStorage.SetItemAsync(TherapiesKey, queue);
            }
        }

        public async Task SyncPendingTherapiesAsync(IHttpClientFactory httpClientFactory)
        {
            if (_isSyncing) return;

            var queue = await GetTherapiesAsync();
            if (queue == null || !queue.Any()) return;

            _isSyncing = true;
            try
            {
                var client = httpClientFactory.CreateClient("Api");
                var successfullySynced = new List<Therapy>();

                foreach (var item in queue)
                {
                    try
                    {
                        var response = await client.PostAsJsonAsync("api/therapies", item);
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
                    await _localStorage.SetItemAsync(TherapiesKey, queue);
                }
            }
            finally
            {
                _isSyncing = false;
            }
        }

        public async Task DeleteTherapyAsync(Therapy therapy)
        {
            var queue = await GetTherapiesAsync();
            queue.RemoveAll(t => t.Id == therapy.Id && t.PatientId == therapy.PatientId);
            await _localStorage.SetItemAsync(TherapiesKey, queue);
        }
    }
}
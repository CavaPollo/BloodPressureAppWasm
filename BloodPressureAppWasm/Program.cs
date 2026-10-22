using Blazored.LocalStorage;
using BloodPressureAppLibrary;
using BloodPressureAppLibrary.Wasm;
using BloodPressureAppWasm;
using Microsoft.AspNetCore.Components.Authorization;
using Microsoft.AspNetCore.Components.Web;
using Microsoft.AspNetCore.Components.WebAssembly.Hosting;
using Microsoft.AspNetCore.Components.WebAssembly.Http;
using MudBlazor.Services;
using Microsoft.Extensions.Configuration;
using System.Net.Http;
using System.Threading;
using System.Threading.Tasks;

var builder = WebAssemblyHostBuilder.CreateDefault(args);
builder.RootComponents.Add<App>("#app");
builder.RootComponents.Add<HeadOutlet>("head::after");

builder.Services.AddMudServices();
builder.Services.AddBlazoredLocalStorage();

builder.Services.AddAuthorizationCore();

builder.Services.AddScoped<AccessTokenStore>();
builder.Services.AddScoped<BloodPressureAppWasm.Services.SyncService>();
builder.Services.AddScoped<BloodPressureAppWasm.Services.ReminderService>();
builder.Services.AddScoped<BloodPressureAppWasm.Services.PushNotificationService>();
builder.Services.AddScoped<ProductionAuthStateProvider>(sp =>
    new ProductionAuthStateProvider(
        sp.GetRequiredService<AccessTokenStore>(),
        sp.GetRequiredService<IHttpClientFactory>(),
        sp.GetRequiredService<ILocalStorageService>()
    ));
builder.Services.AddScoped<AuthMessageHandler>();

builder.Services.AddScoped<AuthenticationStateProvider>(
    sp => sp.GetRequiredService<ProductionAuthStateProvider>());

// Load configuration from appsettings.json and appsettings.Environment.json
builder.Configuration.AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
                   .AddJsonFile($"appsettings.{builder.HostEnvironment.Environment}.json", optional: true, reloadOnChange: true);

// Configure HTTP clients using configuration
builder.Services.AddHttpClient("Api", c =>
{
    var apiBaseUrl = builder.Configuration["Api:BaseUrl"];
    if (!string.IsNullOrEmpty(apiBaseUrl))
    {
        c.BaseAddress = new Uri(apiBaseUrl);
    }
    else
    {
        // Fallback to hardcoded value
        c.BaseAddress = new Uri("http://192.168.1.12:81");
    }
    // Configure HTTP client to handle offline scenarios
    c.Timeout = TimeSpan.FromSeconds(30);
    c.DefaultRequestHeaders.Add("Accept", "application/json");
})
.AddHttpMessageHandler<AuthMessageHandler>();

builder.Services.AddHttpClient("Auth", c =>
{
    var authBaseUrl = builder.Configuration["Auth:BaseUrl"];
    if (!string.IsNullOrEmpty(authBaseUrl))
    {
        c.BaseAddress = new Uri(authBaseUrl);
    }
    else
    {
        c.BaseAddress = new Uri("http://192.168.1.12:81/api/auth/");
    }
});

await builder.Build().RunAsync();

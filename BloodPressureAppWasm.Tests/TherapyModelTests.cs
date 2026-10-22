using BloodPressureAppLibrary;
using Xunit;

namespace BloodPressureAppWasm.Tests;

public class TherapyModelTests
{
    [Fact]
    public void Therapy_GetDoseTimes_OnceDaily_ReturnsSingleTime()
    {
        // Arrange
        var therapy = new Therapy
        {
            FrequencyType = FrequencyType.OnceDaily
        };

        // Act
        var times = therapy.GetDoseTimes().ToList();

        // Assert
        Assert.Single(times);
        Assert.Equal(new TimeOnly(8, 0), times[0]);
    }

    [Fact]
    public void Therapy_GetDoseTimes_TwiceDaily_ReturnsTwoTimes()
    {
        // Arrange
        var therapy = new Therapy
        {
            FrequencyType = FrequencyType.TwiceDaily
        };

        // Act
        var times = therapy.GetDoseTimes().ToList();

        // Assert
        Assert.Equal(2, times.Count);
        Assert.Equal(new TimeOnly(8, 0), times[0]);
        Assert.Equal(new TimeOnly(20, 0), times[1]);
    }

    [Fact]
    public void Therapy_GetDoseTimes_ThreeTimesDaily_ReturnsThreeTimes()
    {
        // Arrange
        var therapy = new Therapy
        {
            FrequencyType = FrequencyType.ThreeTimesDaily
        };

        // Act
        var times = therapy.GetDoseTimes().ToList();

        // Assert
        Assert.Equal(3, times.Count);
        Assert.Equal(new TimeOnly(8, 0), times[0]);
        Assert.Equal(new TimeOnly(14, 0), times[1]);
        Assert.Equal(new TimeOnly(20, 0), times[2]);
    }

    [Fact]
    public void Therapy_GetDoseTimes_EveryXHours_ReturnsCorrectTimes()
    {
        // Arrange
        var therapy = new Therapy
        {
            FrequencyType = FrequencyType.EveryXHours,
            EveryHours = 8
        };

        // Act
        var times = therapy.GetDoseTimes().ToList();

        // Assert
        Assert.Equal(3, times.Count); // 00:00, 08:00, 16:00
        Assert.Equal(new TimeOnly(0, 0), times[0]);
        Assert.Equal(new TimeOnly(8, 0), times[1]);
        Assert.Equal(new TimeOnly(16, 0), times[2]);
    }

    [Fact]
    public void Therapy_GetDoseTimes_EveryXHours_WithDifferentIntervals()
    {
        // Arrange - Every 6 hours
        var therapy = new Therapy
        {
            FrequencyType = FrequencyType.EveryXHours,
            EveryHours = 6
        };

        // Act
        var times = therapy.GetDoseTimes().ToList();

        // Assert - 00:00, 06:00, 12:00, 18:00
        Assert.Equal(4, times.Count);
        Assert.Equal(new TimeOnly(0, 0), times[0]);
        Assert.Equal(new TimeOnly(6, 0), times[1]);
        Assert.Equal(new TimeOnly(12, 0), times[2]);
        Assert.Equal(new TimeOnly(18, 0), times[3]);
    }

    [Fact]
    public void Therapy_GetDoseTimes_CustomTimes_ReturnsCustomTimes()
    {
        // Arrange
        var therapy = new Therapy
        {
            FrequencyType = FrequencyType.CustomTimes,
            CustomTimes = new List<TimeOnly>
            {
                new TimeOnly(7, 30),
                new TimeOnly(13, 0),
                new TimeOnly(19, 30)
            }
        };

        // Act
        var times = therapy.GetDoseTimes().ToList();

        // Assert
        Assert.Equal(3, times.Count);
        Assert.Equal(new TimeOnly(7, 30), times[0]);
        Assert.Equal(new TimeOnly(13, 0), times[1]);
        Assert.Equal(new TimeOnly(19, 30), times[2]);
    }

    [Fact]
    public void Therapy_GetDoseTimes_CustomTimesEmpty_FallbacksToDefault()
    {
        // Arrange
        var therapy = new Therapy
        {
            FrequencyType = FrequencyType.CustomTimes,
            CustomTimes = new List<TimeOnly>() // Empty
        };

        // Act
        var times = therapy.GetDoseTimes().ToList();

        // Assert - Should fallback to default (8:00)
        Assert.Single(times);
        Assert.Equal(new TimeOnly(8, 0), times[0]);
    }

    [Fact]
    public void Therapy_GetFrequencyDisplay_ReturnsCorrectString()
    {
        // Arrange & Act & Assert
        Assert.Equal("1 volta al giorno", new Therapy { FrequencyType = FrequencyType.OnceDaily }.GetFrequencyDisplay());
        Assert.Equal("2 volte al giorno", new Therapy { FrequencyType = FrequencyType.TwiceDaily }.GetFrequencyDisplay());
        Assert.Equal("3 volte al giorno", new Therapy { FrequencyType = FrequencyType.ThreeTimesDaily }.GetFrequencyDisplay());
        Assert.Equal("Ogni 8 ore", new Therapy { FrequencyType = FrequencyType.EveryXHours, EveryHours = 8 }.GetFrequencyDisplay());
        Assert.Equal("08:00, 20:00", new Therapy { FrequencyType = FrequencyType.CustomTimes, CustomTimes = new List<TimeOnly> { new TimeOnly(8, 0), new TimeOnly(20, 0) } }.GetFrequencyDisplay());
        Assert.Equal("1 volta al giorno", new Therapy { FrequencyType = FrequencyType.CustomTimes, CustomTimes = new List<TimeOnly>() }.GetFrequencyDisplay()); // Empty falls back
    }

    [Fact]
    public void Therapy_DefaultValues_AreCorrect()
    {
        // Arrange & Act
        var therapy = new Therapy();

        // Assert
        Assert.Equal(FrequencyType.OnceDaily, therapy.FrequencyType);
        Assert.True(therapy.IsActive);
        Assert.Equal(DateTime.Today, therapy.StartDate);
        Assert.NotNull(therapy.CustomTimes);
        Assert.Empty(therapy.CustomTimes);
        Assert.Null(therapy.EveryHours);
    }

    [Fact]
    public void Therapy_CustomTimes_OrderedCorrectly()
    {
        // Arrange
        var therapy = new Therapy
        {
            FrequencyType = FrequencyType.CustomTimes,
            CustomTimes = new List<TimeOnly>
            {
                new TimeOnly(20, 0),  // 8 PM
                new TimeOnly(8, 0),   // 8 AM
                new TimeOnly(14, 0)   // 2 PM
            }
        };

        // Act
        var times = therapy.GetDoseTimes().ToList();

        // Assert - Should be ordered
        Assert.Equal(3, times.Count);
        Assert.Equal(new TimeOnly(8, 0), times[0]);
        Assert.Equal(new TimeOnly(14, 0), times[1]);
        Assert.Equal(new TimeOnly(20, 0), times[2]);
    }
}
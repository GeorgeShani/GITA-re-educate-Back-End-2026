#!/usr/bin/env node

/**
 * TASK: WEATHER CLI TOOL
 *
 * Command:
 * - weather-cli <city>
 *
 * Behavior:
 * - Fetch weather from OpenWeather API
 * - Show structured weather report
 * - Map weather conditions to emojis
 * - Handle errors clearly
 */

import { Command } from "commander";
import chalk from "chalk";

const program = new Command();

const API_KEY = "895284fb2d2c50a520ea537456963d9c";

/* WEATHER EMOJI MAPPER */
function getWeatherEmoji(condition) {
  const map = {
    Thunderstorm: "⛈️",
    Drizzle: "🌦️",
    Rain: "🌧️",
    Snow: "❄️",
    Clear: "☀️",
    Clouds: "☁️",
    Mist: "🌫️",
    Smoke: "🌫️",
    Haze: "🌫️",
    Dust: "🌪️",
    Fog: "🌫️",
    Sand: "🌪️",
    Ash: "🌋",
    Squall: "💨",
    Tornado: "🌪️",
  };

  return map[condition] || "🌡️";
}

/* API LAYER */
async function getWeather(city) {
  console.log(chalk.gray(`🔎 Fetching weather data for "${city}"...\n`));

  const url = `https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=${API_KEY}`;

  const response = await fetch(url);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`City "${city}" was not found. Please check spelling.`);
    }

    throw new Error("Weather service is currently unavailable.");
  }

  return response.json();
}

/* CLI */
program
  .argument("<city>")
  .description("Get current weather information for a city")
  .action(async (city) => {
    try {
      const data = await getWeather(city);

      const weatherMain = data.weather[0].main;
      const weatherDesc = data.weather[0].description;
      const weatherEmoji = getWeatherEmoji(weatherMain);

      console.log(chalk.green.bold(`🌍 Weather in ${data.name}\n`));

      console.log(
        chalk.cyan("⛅ Condition:"),
        `${weatherMain} ${weatherEmoji}`
      );

      console.log(
        chalk.cyan("📝 Details:"),
        `${weatherDesc} ${weatherEmoji}`
      );

      console.log(chalk.yellow("\n🌡️  Temperature"));

      console.log(`🔥 Current: ${data.main.temp}°C`);
      console.log(`🥶 Feels like: ${data.main.feels_like}°C`);
      console.log(`📉 Min: ${data.main.temp_min}°C`);
      console.log(`📈 Max: ${data.main.temp_max}°C`);

      console.log(chalk.blue("\n💧 Humidity:"), `${data.main.humidity}%`);
      console.log(chalk.blue("💨 Wind:"), `${data.wind.speed} m/s\n`);

    } catch (err) {
      console.log(chalk.red("\n⚠️ Weather request failed"));
      console.log(chalk.red(err.message), "\n");
    }
  });

program.parse(process.argv);
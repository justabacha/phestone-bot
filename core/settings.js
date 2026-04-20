const fs = require('fs');
const path = require('path');

const settingsPath = path.join(__dirname, '../settings.json');

// Default settings
const defaultSettings = {
  antidelete: 'off', // 'off', 'all', 'group', 'private'
  autoView: false,
  autoReact: false,
  reactEmojis: ['✨', '👀', '🔥', '❤️', '😮'],
};

function loadSettings() {
  try {
    if (fs.existsSync(settingsPath)) {
      const data = fs.readFileSync(settingsPath, 'utf-8');
      return { ...defaultSettings, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
  return defaultSettings;
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
    return true;
  } catch (err) {
    console.error('Error saving settings:', err);
    return false;
  }
}

function get(key) {
  const settings = loadSettings();
  return settings[key];
}

function set(key, value) {
  const settings = loadSettings();
  settings[key] = value;
  return saveSettings(settings);
}

module.exports = { get, set };
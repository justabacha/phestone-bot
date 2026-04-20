module.exports = {
  apps : [{
    name   : "phestone-bot",
    script : "./index.js",
    watch  : false,
    env: {
      NODE_ENV: "production"
    }
  }]
};
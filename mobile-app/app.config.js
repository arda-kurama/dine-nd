require("dotenv").config();

module.exports = ({ config }) => ({
    ...config,
    extra: {
        // Preserve anything else in extra
        ...(config.extra || {}),
        // Inject the Statsig key from .env
        STATSIG_CLIENT_KEY: process.env.STATSIG_CLIENT_KEY,
    },
});

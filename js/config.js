/**
 * GCC SmartCheck — Runtime Configuration
 *
 * These values are sourced from the .env file.
 * For a static deployment (GitHub Pages) you populate this file
 * from your .env before pushing — the .env itself is gitignored.
 *
 * ⚠️  Do NOT commit real secrets to a public repo.
 *     Use GitHub Actions secrets + a build step to inject them,
 *     or keep the repo private.
 */

const GCC_CONFIG = Object.freeze({
  parse: {
    appId:     'vZBXXEyIttr1s1FttpgmU1IKya7NIZkkqqn6w80t',
    clientKey: 'NqCURU0dHEJ4hn2yol6Q0r0c8bvlJMRex7MXjrsN',
    serverURL: 'https://parseapi.back4app.com',
  },
});

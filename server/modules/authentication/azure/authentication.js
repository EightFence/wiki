const _ = require('lodash')

/* global WIKI */

// ------------------------------------
// Azure AD Account
// ------------------------------------

const OIDCStrategy = require('passport-azure-ad').OIDCStrategy

module.exports = {
  init (passport, conf) {
    // Workaround for Chrome's SameSite cookies
    // cookieSameSite needs useCookieInsteadOfSession to work correctly.
    // cookieEncryptionKeys is extracted from conf.cookieEncryptionKeyString.
    // It's a concatnation of 44-character length strings each of which represents a single pair of key/iv.
    // Valid cookieEncryptionKeys enables both cookieSameSite and useCookieInsteadOfSession.
    const keyArray = [];
    if (conf.cookieEncryptionKeyString) {
      let keyString = conf.cookieEncryptionKeyString;
      while (keyString.length >= 44) {
        keyArray.push({ key: keyString.substring(0, 32), iv: keyString.substring(32, 44) });
        keyString = keyString.substring(44);
      }
    }
	
	// If a client secret was passed, then we use code flow! 
	// If not, just use the same value previous version of wiki.js!
	// Same for response mode. We want query respondeMode to avoid depending on cookies!
	let respType = conf.clientSecret ? 'code' : 'id_token'
	let respMode = conf.clientSecret ? 'query' : 'form_post'
	let issuerList;
	
	if(conf.issuerList){
		// List of issuers.
		// Expect each line containing the issuer definition!
		issuerList = conf.issuerList.split('\n');
	}
	
    passport.use(conf.key,
      new OIDCStrategy({
        identityMetadata: conf.entryPoint,
        clientID: conf.clientId,
        redirectUrl: conf.callbackURL,
        responseType: respType,
        responseMode: respMode,
        scope: ['profile', 'email', 'openid'],
        allowHttpForRedirectUrl: (WIKI.IS_DEBUG || conf.allowHttp),
        passReqToCallback: true,
        cookieSameSite: keyArray.length > 0,
        useCookieInsteadOfSession: keyArray.length > 0,
        cookieEncryptionKeys: keyArray
		,clientSecret: conf.clientSecret
		,issuer: issuerList
      }, async (req, iss, sub, profile, cb) => {
        const usrEmail = _.get(profile, '_json.email', null) || _.get(profile, '_json.preferred_username')
        try {
          const user = await WIKI.models.users.processProfile({
            providerKey: req.params.strategy,
            profile: {
              id: profile.oid,
              displayName: profile.displayName,
              email: usrEmail,
              picture: ''
            }
          })
          cb(null, user)
        } catch (err) {
          cb(err, null)
        }
      })
    )
  }
}

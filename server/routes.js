var express = require('express');
var router = express.Router();
var request = require('request');
var properties = require(__dirname+'/../properties/properties');
var utils = require(__dirname+'/../services/utils');

var passport;

const { ourContextPath } = properties.esup

/** @param {{ relUrl: string; bearerAuth?: true, method?: 'POST'|'PUT'|'DELETE' }} opts_ */
function request_otp_api(req, res, opts_) {
    console.log("requesting api");
    let opts = {
        method: opts_.method,
        url: properties.esup.api_url + opts_.relUrl,
        body: req.body,
        json: true
    }
    if (opts_.bearerAuth) {
        opts.auth = { 'bearer': properties.esup.api_password }
    }

    request(opts, function(error, response, body) {
        if (!error && response.statusCode == 200) {
            var infos = body; 
            if(req.session.passport.user.uid)infos.uid = req.session.passport.user.uid;
            infos.api_url = properties.esup.api_url;
            res.send(infos);
        } else {
            if(!response) {
                // Api did not respond (crash ?)
                res.status(503);
                res.send({
                    message: "Api did not give a response"
                });
                return;
            }

            // forward the status code, because if the request failed
            // it should not be responding with 200 ("everything is fine !")
            //
            // this helps to have clearer error messages, because getting
            // "error, code 200" with a message containing just "Error" is
            // kind of frustrating.
            res.status(response?.statusCode ?? 500);

            const contentType = response.headers['content-type'];
            let forwardedError = response.body; 
            if(contentType === "application/json") {
                forwardedError = response.body;
            }

            res.send({
                message : `Error forwarded from API response`,
                forwarded: forwardedError,
            });
        }
    });
}

function isAuthenticated(req, res) {
    if (req.session.passport) {
        if (req.session.passport.user) {
            return true;
        }
    }
    return false;
}

function isUser(req, res, next) {
    if (isAuthenticated(req, res)) return next();
    res.redirect(ourContextPath + 'login');
}

function isManager(req, res, next) {
    if (isAuthenticated(req, res)) {
        if (utils.is_manager(req.session.passport.user) || utils.is_admin(req.session.passport.user))return next();
        res.redirect(ourContextPath + 'forbidden');
    }
    res.redirect(ourContextPath + 'login');
}

function isAdmin(req, res, next) {
    if (isAuthenticated(req, res)) {
        if(utils.is_admin(req.session.passport.user))return next();
        res.redirect(ourContextPath + 'forbidden');
    }
    res.redirect(ourContextPath + 'login');
}

function routing() {
    router.get('/', function(req, res) {
        res.render('index', {
            title: 'Esup Otp Manager',
            messages : properties.messages
        });
    });

    router.get('/forbidden', isUser, function(req, res) {
        res.render('forbidden', {
            title: 'Esup Otp Manager',
            user: req.session.passport.user
        });
    });

    router.get('/preferences', isUser, function(req, res) {
        var right = "user";
        if (utils.is_manager(req.session.passport.user))right = "manager";
        if (utils.is_admin(req.session.passport.user))right = "admin";
        res.render('dashboard', {
            title: 'Esup Otp Manager : Test',
            user: req.session.passport.user,
            right : right
        });
    });

    router.get('/login', function(req, res, next) {
        passport.authenticate('cas', function(err, user, info) {
            if (err) {
                console.log(err);
                return next(err);
            }

            if (!user) {
                console.log(info.message);
                return res.redirect(ourContextPath);
            }

            req.logIn(user, function(err) {
                if (err) {
                    console.log(err);
                    return next(err);
                }
                req.session.messages = '';
                return res.redirect(ourContextPath + 'preferences');
            });
        })(req, res, next);
    });

    router.get('/logout', function(req, res) {
        req.logout(function(err) {
            if (err) { return next(err); }
            res.redirect(properties.esup.CAS.casBaseURL+'/logout');
          });
    });

    //API
    router.get('/api/user', isUser, function(req, res) {
        request_otp_api(req, res, {
            relUrl: 'users/' + req.session.passport.user.uid + '/' + utils.get_hash(req.session.passport.user.uid),
        });
    });

    router.get('/api/messages', function(req, res) {
        var lang = req.acceptsLanguages('fr', 'en');
        if(lang) {
            res.json(require("../properties/messages_" + lang + ".json")); 
        } else {
            res.json(require("../properties/messages.json"));
        }
    });

    router.get('/api/messages/:language', isUser, function(req, res) {
            switch (req.params.language){
                case "français": res.json(require("../properties/messages_fr.json"));break;
                case "english": res.json(require("../properties/messages_en.json")); break;
                default : res.json(require("../properties/messages.json")); break;
            }
    });

    router.get('/manager/users_methods', isUser, function(req, res) {
        var data = new Object();
        data=properties.esup.users_methods;
        data.user=req.user;
        res.send(data);
    });

    router.get('/api/transport/:transport/test/:uid', isUser, function(req, res) {
        request_otp_api(req, res, {
            relUrl: 'protected/users/' + req.params.uid + '/transports/'+ req.params.transport+'/test/', bearerAuth: true,
        });
    });

    router.get('/api/methods', isUser, function(req, res) {
        request_otp_api(req, res, {
            relUrl: 'protected/methods/', bearerAuth: true,
        });
    });

    router.get('/api/secret/:method', isUser, function(req, res) {
        request_otp_api(req, res, {
            relUrl: 'protected/users/'+req.session.passport.user.uid+'/methods/'+req.params.method+'/secret/', bearerAuth: true,
        });
    });

    router.put('/api/:method/activate', isUser, function(req, res) {
        request_otp_api(req, res, {
            method: 'PUT',
            relUrl: 'protected/users/'+req.session.passport.user.uid+'/methods/'+req.params.method+'/activate/', bearerAuth: true,
        });
    });

    router.post('/api/:method/confirm_activate', isUser, function(req, res) {
        request_otp_api(req, res, {
            method: 'POST',
            relUrl: 'protected/users/'+req.session.passport.user.uid+'/methods/'+req.params.method+'/confirm_activate/', bearerAuth: true,
        });
    });

    router.post('/api/:method/auth/:authenticator_id', isUser, function(req, res) {
        request_otp_api(req, res, {
            method: 'POST',
            relUrl: `protected/users/${req.session.passport.user.uid}/methods/${req.params.method}/auth/${req.params.authenticator_id}/`, bearerAuth: true,
        });
    });

    router.delete('/api/:method/auth/:authenticator_id', isUser, function(req, res) {
        request_otp_api(req, res, {
            method: 'DELETE',
            relUrl: `protected/users/${req.session.passport.user.uid}/methods/${req.params.method}/auth/${req.params.authenticator_id}/`, bearerAuth: true,
        });
    });

    router.put('/api/:method/deactivate', isUser, function(req, res) {
        request_otp_api(req, res, {
            method: 'PUT',
            relUrl: 'protected/users/'+req.session.passport.user.uid+'/methods/'+req.params.method+'/deactivate/', bearerAuth: true,
        });
    });

    router.put('/api/transport/:transport/:new_transport/:uid', isUser, function(req, res) {
        request_otp_api(req, res, {
            method: 'PUT',
            relUrl: 'protected/users/'+ req.params.uid +'/transports/'+req.params.transport+'/'+req.params.new_transport+'/', bearerAuth: true,
        });
    });

    router.delete('/api/transport/:transport/:uid', isUser, function(req, res) {
        request_otp_api(req, res, {
            method: 'DELETE',
            relUrl: 'protected/users/'+ req.params.uid +'/transports/'+req.params.transport+'/', bearerAuth: true,
        });
    });

    router.post('/api/generate/:method', isUser, function(req, res) {
        request_otp_api(req, res, {
            method: 'POST',
            relUrl: 'protected/users/'+ req.session.passport.user.uid + '/methods/' + req.params.method + '/secret/', bearerAuth: true,
        });
    });

    router.get('/api/admin/users', isManager, function(req, res) {
        request_otp_api(req, res, {
            relUrl: 'admin/users/', bearerAuth: true,
        });
    });

    router.get('/api/admin/user/:uid', isManager, function(req, res) {
        request_otp_api(req, res, {
            relUrl: 'users/' + req.params.uid + '/' + utils.get_hash(req.params.uid),
        });
    });

    router.put('/api/admin/:uid/:method/activate', isManager, function(req, res) {
        request_otp_api(req, res, {
            method: 'PUT',
            relUrl: 'protected/users/'+ req.params.uid + '/methods/' + req.params.method + '/activate/', bearerAuth: true,
        });
    });

    router.put('/api/admin/:uid/:method/deactivate', isManager, function(req, res) {
        request_otp_api(req, res, {
            method: 'PUT',
            relUrl: 'protected/users/'+ req.params.uid + '/methods/' + req.params.method + '/deactivate/', bearerAuth: true,
        });
    });

    router.put('/api/admin/:method/activate', isAdmin, function(req, res) {
        request_otp_api(req, res, {
            method: 'PUT',
            relUrl: 'admin/methods/' + req.params.method + '/activate/', bearerAuth: true,
        });
    });

    router.put('/api/admin/:method/deactivate', isAdmin, function(req, res) {
        request_otp_api(req, res, {
            method: 'PUT',
            relUrl: 'admin/methods/' + req.params.method + '/deactivate/', bearerAuth: true,
        });
    });

    router.put('/api/admin/:method/transport/:transport/activate', isAdmin, function(req, res) {
        request_otp_api(req, res, {
            method: 'PUT',
            relUrl: 'admin/methods/' + req.params.method + '/transports/'+req.params.transport+'/activate/', bearerAuth: true,
        });
    });

    router.put('/api/admin/:method/transport/:transport/deactivate', isAdmin, function(req, res) {
        request_otp_api(req, res, {
            method: 'PUT',
            relUrl: 'admin/methods/' + req.params.method + '/transports/'+req.params.transport+'/deactivate/', bearerAuth: true,
        });
    });

    router.post('/api/admin/generate/:method/:uid', isManager, function(req, res) {
        request_otp_api(req, res, {
            method: 'POST',
            relUrl: 'protected/users/'+ req.params.uid + '/methods/' + req.params.method + '/secret/', bearerAuth: true,
        });
    });

    router.delete('/api/admin/delete_method_secret/:method/:uid', isManager, function(req, res) {
        request_otp_api(req, res, {
            method: 'DELETE',
            relUrl: 'admin/users/'+req.params.uid +'/methods/' + req.params.method+ '/secret/', bearerAuth: true,
        });
    });
}

module.exports = function(_passport) {
    passport = _passport;

    // used to serialize the user for the session
    passport.serializeUser(function(user, done) {
        var _user = {};
        _user.uid=user.uid;
        _user.attributes=user.attributes;
        if(utils.is_admin(user))_user.role="admin";
        else if(utils.is_manager(user))_user.role="manager";
        else _user.role="user";
        done(null, _user);
    });

    // used to deserialize the user
    passport.deserializeUser(function(user, done) {
            done(null, user);
    });

    passport.use(new(require('passport-apereo-cas').Strategy)(properties.esup.CAS, function(profile, done) {
	// console.log("profile : " + JSON.stringify(profile, null ,2));
        return done(null, {uid:profile.user, attributes:profile.attributes});
    }));

    routing();

    return router
};

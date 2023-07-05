/** jQuery Initialisation **/
(function ($) {
    $(function () {
        $(document).on('click', ".collapsible-header", function(){
            $(this).next('.collapsible-body').toggle(200);
        });
    }); // end of document ready
})(jQuery); // end of jQuery name space

function toggle_visibility(id) {
    var e = document.getElementById(id);
        e.style.width = "240px";
        e.style.left = "0";
}

function hide(id) {
    var e = document.getElementById(id);
    if(document.documentElement.clientWidth >= 992)
        e.style.width = "240px";
    else
        e.style.width = "0";
}

$(window).resize(function() {
    var window_width = $(window).width();
    if(window_width >= 992) {
        $("#slide-out").width(240);
        $("#closebtn").css('visibility','hidden');
    }
    else{
        $("#slide-out").width(0);
        $("#closebtn").css('visibility','visible');
    }
});

/** WebSockets init**/
var arr = window.location.href.split('/');
var urlSockets = arr[0] + "//" + arr[2];
var socket;


/** base64url helper functions **/
/**
* Convert from a Base64URL-encoded string to an Array Buffer. Best used when converting a
* credential ID from a JSON string to an ArrayBuffer, like in allowCredentials or
* excludeCredentials
*
* Helper method to compliment `bufferToBase64URLString`
*/
function base64URLStringToBuffer(base64URLString) {
	// Convert from Base64URL to Base64
	const base64 = base64URLString.replace(/-/g, '+').replace(/_/g, '/');
	/**
	 * Pad with '=' until it's a multiple of four
	 * (4 - (85 % 4 = 1) = 3) % 4 = 3 padding
	 * (4 - (86 % 4 = 2) = 2) % 4 = 2 padding
	 * (4 - (87 % 4 = 3) = 1) % 4 = 1 padding
	 * (4 - (88 % 4 = 0) = 4) % 4 = 0 padding
	 */
	const padLength = (4 - (base64.length % 4)) % 4;
	const padded = base64.padEnd(base64.length + padLength, '=');

	// Convert to a binary string
	const binary = atob(padded);

	// Convert binary string to buffer
	const buffer = new ArrayBuffer(binary.length);
	const bytes = new Uint8Array(buffer);

	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}

	return buffer;
}

/**
* Convert the given array buffer into a Base64URL-encoded string. Ideal for converting various
* credential response ArrayBuffers to string for sending back to the server as JSON.
*
* Helper method to compliment `base64URLStringToBuffer`
* 
* source: https://github.com/MasterKale/SimpleWebAuthn/blob/master/packages/browser/src/helpers/bufferToBase64URLString.ts
*/
function bufferToBase64URLString(buffer) {
	const bytes = new Uint8Array(buffer);
	let str = '';

	for (const charCode of bytes) {
		str += String.fromCharCode(charCode);
	}

	const base64String = btoa(str);

	return base64String.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

/** Vue.JS **/

/** User **/
var PushMethod = Vue.extend({
    props: {
        'user': Object,
        'get_user': Function,
        'messages': Object,
        'activate': Function,
        'deactivate': Function,
        'switch_push_event': {}
    },
    created: function () {
        var self = this;
        socket = io.connect(urlSockets, { reconnect: true, path: new URL("sockets", location.href).pathname });

        socket.on('userPushActivate', function () {
            self.activatePush();
        });

        socket.on('userPushActivateManager', function (data) {
            self.activatePush();
        });
  	
	socket.on('userPushDeactivate', function () {
            self.deActivatePush();
        });
    },
    methods: {
        activatePush: function () {
            this.get_user(this.user.uid);
        },
	deActivatePush: function () {
            this.get_user(this.user.uid);		
        }
    },
    template: '#push-method'
});

var BypassMethod = Vue.extend({
    props: {
        'user': Object,
        'generate_bypass': Function,
        'activate': Function,
        'deactivate': Function,
        'messages': Object
    },
    template: '#bypass-method'
});

var TotpMethod = Vue.extend({
    props: {
        'user': Object,
        'generate_totp': Function,
        'activate': Function,
        'deactivate': Function,
        'messages': Object,
    },
    template: '#totp-method'
});

const WebAuthnSingleFactor = Vue.extend({
	props: {
		messages: Object,

		// authenticator props
		name: String,
		credentialID: String,

		// index of this factor in the
		// array of all factors.
		id: Number,
	},

	data: function() {
		return {
			hovering_edit: false,

			// contains the name as it is being typed ; 
			// reflects the value of the input field
			nameBeingTyped: "",

			// @TODO(Guilian): get this value from esup.json
			maxCharsAllowed: 20,

			// When cancelling, set this as the "new name" (go back to before edit)
			nameMemory: null,
		};
	},
	computed: {
		editing: function() {
			const is = this.name === null;
			if(is) {
				// Vue.nextTick does not seem to work
				// => wait for next turn of event loop
				setTimeout(() => {
					document.querySelector("#new-name-input")?.focus();
				}, 0);				
			}
			return is;
		},
		characterCountIndicator() {
			return `${this.nameBeingTyped.length}/${this.maxCharsAllowed}`;
		},
	},
	methods: {

		startEditing: function() {
			// prevents icon from being stuck in edit-hover mode (because the 
			// mouseleave event of the icon is never fired)
			this.hovering_edit = false;

			this.nameMemory = this.name.slice(0);
			this.$emit('newfactorname', null,  this.nameMemory, this.credentialID);
			// Vue.nextTick does not seem to work
			// => wait for next turn of event loop
			setTimeout(() => {
				this.nameBeingTyped = this.nameMemory;
				document.querySelector("#new-name-input").value = this.nameMemory;
			}, 0);	
		},

		/**
		 * This function is called after onBeforeNameBeingTyped, if 
		 * the event in that function was not cancelled.
		 * It just updates the internal representation of the typed text. 
		 * @param {InputEvent} e the input event 
		 */
		onNameTyped: function(e) {
			this.nameBeingTyped = e.target.value;
		},

		/**
		 * When trying to enter some text in the field,
		 * this function checks if entering such text 
		 * is valid (too long, wrong characters, etc.)
		 * @param {InputEvent} event the before input event
		 */
		onBeforeNameBeingTyped: function(event) {
			const ignore = [
				"deleteContentBackward",
				"deleteWordBackward"
			];

			if(ignore.includes(event.inputType)) {
				return true;
			}

			const proposition = (this.nameBeingTyped + event.data);

			if(proposition.length > this.maxCharsAllowed) {
				event.preventDefault();
				return false;
			}

			if(/^[a-zA-Z0-9_^¨éêèà ]{1,20}$/g.test(proposition) === false) {
				event.preventDefault();
				return false;
			}

			return true;
		},

		cancelChoosingName: function(){
			this.$emit('newfactorname', this.nameMemory,  this.nameMemory, this.credentialID);
		},

		resolveChoosingName: function() {
			if(!this.editing) {
				Materialize.toast(this.messages.error.webauthn.generic, 3000, 'red darken-1');
				return;
			}
			
			const textValue = document.querySelector("#new-name-input").value;
			

			if(typeof textValue !== 'string') {
				Materialize.toast(this.messages.error.webauthn.generic, 3000, 'red darken-1');
				return;
			}

			if(textValue.length < 1 || textValue.length > this.maxCharsAllowed) {
				Materialize.toast(this.messages.error.webauthn.input_hint_length, 3000, 'red darken-1');
				return;
			}

		
			if(/^[a-zA-Z0-9_éêèà ]{1,20}$/g.test(textValue) === false) {
				Materialize.toast(this.messages.error.webauthn.input_hint_type, 3000, 'red darken-1');
				return;
			}

			this.nameBeingTyped = "";
			this.$emit('newfactorname', textValue, this.nameMemory, this.credentialID);
			return;
		},
	},
	
	template: '#webauthn-singlefactor',
});


const WebAuthnMethod = Vue.extend({
	props: {
		'user': Object,
		'generate_webauthn': Function,
		'activate': Function,
		'deactivate': Function,
		'messages': Object,
		'method': Object,
	},
	components: {
		WebAuthnSingleFactor	
	},
	data: function() {
		return {
			// = waiting for server response
			waiting_for_fetch: true,

			// = waiting for user interaction with the MFA factor
			waiting_for_user_input: false,

			// data about user fetched from api call
			realData: null,
		};
	},
	computed: {
		showAddButton() {
			if(this.data.auths.length === 0) {
				return true;
			}
			// if a name is null, we're naming a new factor
			return this.data.auths.every(auth => auth.name !== null);
		},

		data() {
			return this.realData ?? {};
		},

		gotData() {
			return this.realData !== null;
		},

		descriptionMessage() {
			if(this.data.auths.every(auth => auth.name !== null) === false) {
				return this.messages.api.action.webauthn.give_name_to_factor.replace('%CANCEL_KEY%', `<kbd>${this.messages.api.key.escape}</kbd>`);
			}
			
			if(this.data.auths.length == 0) {
				return this.messages.api.methods.webauthn.no_authentificators;
			}
			else if(this.data.auths.length == 1) {
				return this.messages.api.methods.webauthn.single_auth;
			}
			else {
				return this.messages.api.methods.webauthn.nb_of_auths.replace('%NB%', this.data.auths.length);
			}
		},
	},
	methods: {
		findAuthenticatorIndex: function(fromID) {
			return this.realData.auths.findIndex(auth => auth.credentialID === fromID);
		},

		updateFactorName: async function(name, prevName, id) {
			// name is null => editing
			if(name !== null) {
				await this.renameAuthenticator(id, name, prevName);
			}
			else {
				const matchingAuthIndex = this.findAuthenticatorIndex(id);
				
				if(matchingAuthIndex === -1) {
					return;
				}
				this.realData.auths[matchingAuthIndex].name = null;
			}
		},

		fetchAuthnData: async function() {
			let fetchedData;
			try {
				this.waiting_for_fetch = true;
				const res = await fetch("api/secret/webauthn", {method: "GET"});

				if(res.headers.get('content-type').split(';').includes("application/json") === false) {
					//console.error("Incorrect api response type : " + res.headers.get('content-type'));
					throw new Error("Incorrect api response type : " + res.headers.get('content-type'));
				}
				
				fetchedData = await res.json();
			}
			catch(e) {
				// @TODO(Guilian): improve error handling
				fetchedData = null;
			}
			finally {
				this.waiting_for_fetch = false;
				
			}
			return fetchedData;
		},
		deleteAuthenticatorConfirm: async function(authCredID) {
			if(window.confirm(this.messages.api.action.webauthn.confirm_delete)) {
				this.deleteAuthenticator(authCredID);
			}
		},

		renameAuthenticator: async function(authCredID, newName, previousName, showSuccessToast = true) {
			// optimistic UI (show change before server accepts)
			const matchingAuthIndex = this.findAuthenticatorIndex(authCredID);

			// previousName is provided because editing the name of a factor
			// sets it's name attribute to null.
			if(previousName === newName) {
				// don't send data to server 
				this.realData.auths[matchingAuthIndex].name = newName;
				return;
			}
			
			// change AFTER comparing
			this.realData.auths[matchingAuthIndex].name = newName;
			
			try {
				this.waiting_for_fetch = true;

				const res = await fetch("api/webauthn/auth/" + authCredID, {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
						},
						body: JSON.stringify({
							name: newName
						})
					}, 
				);
				
				if(200 <= res.status && res.status < 300) {
					// update data
					this.realData = await this.fetchAuthnData();
					// FIXME display correct message ? maybe ?
					if(showSuccessToast) {
						Materialize.toast(this.messages.success.webauthn.registered, 3000, 'green darken-1');
					}
				}
				else {
					Materialize.toast(this.messages.error.webauthn.generic, 3000, 'red darken-1');
				}
			}
			catch(e) {
				Materialize.toast(this.messages.error.webauthn.generic, 3000, 'red darken-1');
			}
			finally {
				this.waiting_for_fetch = false;
			}
		},

		deleteAuthenticator: async function(authCredID) {
			try {
				this.waiting_for_fetch = true;

				const res = await fetch("api/webauthn/auth/" + authCredID, {method: "DELETE"});
				
				if(200 <= res.status && res.status < 300) {
					// @TODO(Guilian): can filter directly instead of refetching
					this.realData = await this.fetchAuthnData();
					Materialize.toast(this.messages.success.webauthn.deleted, 3000, 'green darken-1');
				}
				else {
					Materialize.toast(this.messages.error.webauthn.delete_failed, 3000, 'red darken-1');
				}
			}
			catch(e) {
				Materialize.toast(this.messages.error.webauthn.delete_failed, 3000, 'red darken-1');
			}
			finally {
				this.waiting_for_fetch = false;
			}
		},
		generateWebauthn: async function(onError) {
			try {
				const data = await this.fetchAuthnData();

				// arguments for the webauthn registration
				const publicKeyCredentialCreationOptions = {
					challenge: base64URLStringToBuffer(data.nonce),
					rp: data.rp,
					rpId: data.rp.id,
					user: {
						id: Uint8Array.from(data.user_id), 
						name: `${this.user.uid}@${data.rp.id}`,
						displayName: `${this.user.uid}` 
					},
					// Spec recommends at least supporting these
					pubKeyCredParams: data.pubkeyTypes,
					// user has 60 seconds to register
					timeout: 60000,
					// leaks data about the user if in direct mode.
					attestation: "none",
					extensions: {
						credProps: true,
					},
					authenticatorSelection: {
						residentKey:"preferred",
						requireResidentKey:false,
						userVerification:"preferred"
					},
					// Don't register the same credentials twice
					excludeCredentials: data.auths.map(a => ({id: base64URLStringToBuffer(a.credentialID), type: "public-key"})),
				};

				this.waiting_for_user_input = true;
				// register
				const credentials = await navigator.credentials.create({publicKey: publicKeyCredentialCreationOptions});

				this.waiting_for_user_input = false;

				// PublicKeyCredential can not be serialized
				// because it contains some ArrayBuffers, which
				// can not be serialized.
				// This just translates the buffer to its' 'safe'
				// version.
				// This is only for the REGISTRATION part
        		// It is slightly different from what is
        		// used for authentication
				const SerializePKC = PKC => {
					return {
						id: PKC.id,
						type: PKC.type,
						rawId: bufferToBase64URLString(PKC.rawId),
						response: {
							attestationObject: bufferToBase64URLString(PKC.response.attestationObject),
							clientDataJSON: bufferToBase64URLString(PKC.response.clientDataJSON),
						}
					};
				}

				

				
				this.waiting_for_fetch = true;

				const verifyRes = await fetch("api/webauthn/confirm_activate", {
					method: "POST",
					headers: {
						'Content-type': 'application/json'
					},
					body: JSON.stringify({
						cred: SerializePKC(credentials),
						cred_name: ""
					}),
				});
				this.waiting_for_fetch = false;

				if(200 <= verifyRes.status && verifyRes.status < 300) {
					const { registered } = await verifyRes.json();

					if(registered) {
						// name chooser dialog
						this.realData = await this.fetchAuthnData();
					}
					else {
						Materialize.toast(this.messages.error.webauthn.registration_failed, 3000, 'red darken-1');
					}
				}
				else {
					// timed out
					if(verifyRes.status === 422) {
						Materialize.toast(this.messages.error.webauthn.timeout, 3000, 'red darken-1');
					}
					else {
						Materialize.toast(this.messages.error.webauthn.generic, 3000, 'red darken-1');
					}
				}
			}
			catch(e) {
				if (typeof (onError) === "function") {
					onError();
				}
				this.user.methods.webauthn.waiting = false;

				// Already registered
				if(e.name === "InvalidStateError") {
					Materialize.toast(this.messages.error.webauthn.already_registered, 3000, 'red darken-1');
				} 
				// user said no / something like that
				else if(e.name === "NotAllowedError") {
					Materialize.toast(this.messages.error.webauthn.user_declined, 3000, 'red darken-1');
				}
				else {
					Materialize.toast(this.messages.error.webauthn.generic, 3000, 'red darken-1');
					console.error("api/webauthn/confirm_activate", status, e.toString());
				}
			}
		},
	},
	async mounted() {
		this.realData = await this.fetchAuthnData();

		if(this.realData.auths.length === 0) {
			this.generateWebauthn();
		}
	},
	beforeUnmount() {
		if(this.data.auths.length === 0) {
			fetch("api/webauthn/activate", {method: "PUT"})
		}
	},
	template: '#webauthn-method',
});

var RandomCodeMethod = Vue.extend({
    props: {
        'user': Object,
        'messages': Object,
        'activate': Function,
        'deactivate': Function,
    },
    methods: {
        saveTransport: function(transport) {
            var new_transport = document.getElementById(transport + '-input').value;
            var reg;
            if (transport == 'sms') reg = new RegExp("^0[6-7]([-. ]?[0-9]{2}){4}$");
            else reg = new RegExp(/^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/);
            if (reg.test(new_transport)) {
                var oldTransport = this.user.transports[transport];
                this.user.transports[transport]= new_transport;
                document.getElementById(transport + '-input').value = '';
                $.ajax({
                    method: 'PUT',
                    url: 'api/transport/' + transport + '/' + new_transport + '/' + this.user.uid,
                    dataType: 'json',
                    cache: false,
                    success: function(data) {
                        if (data.code != "Ok") {
                            this.user.transports[transport]= oldTransport;
                            document.getElementById(transport + '-input').value = oldTransport;
                            Materialize.toast('Erreur interne, veuillez réessayer plus tard.', 3000, 'red darken-1');
                        }else Materialize.toast('Transport vérifié', 3000, 'green darken-1');
                    }.bind(this),
                    error: function(xhr, status, err) {
                        this.user.transports[transport]= oldTransport;
                        document.getElementById(transport + '-input').value = oldTransport;
                        Materialize.toast(err, 3000, 'red darken-1');
                        console.error('api/transport/' + transport + '/' + new_transport, status, err.toString());
                    }.bind(this)
                });
            }else Materialize.toast('Format invalide.', 3000, 'red darken-1');
        },
        deleteTransport: function(transport) {
            var oldTransport = this.user.transports[transport];
            this.user.transports[transport]= null;
            $.ajax({
                method: 'DELETE',
                url: 'api/transport/' + transport + '/' + this.user.uid,
                dataType: 'json',
                cache: false,
                success: function(data) {
                    if (data.code != "Ok") this.user.transports[transport]= oldTransport;
                }.bind(this),
                error: function(xhr, status, err) {
                    this.user.transports[transport]= oldTransport;
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("/data/deactivate.json", status, err.toString());
                }.bind(this)
            });
        },
        testTransport: function(transport) {
            $.ajax({
                url: 'api/transport/' + transport + '/test/' + this.user.uid,
                dataType: 'json',
                cache: false,
                success: function(data) {
                    if (data.code != "Ok") Materialize.toast(data.message, 3000, 'red darken-1');
                    else Materialize.toast('Transport vérifié', 3000, 'green darken-1');
                }.bind(this),
                error: function(xhr, status, err) {
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error('api/transport/' + transport + '/test', status, err.toString());
                }.bind(this)
            });
        },
    },
    template: '#random_code-method'
});

var RandomCodeMailMethod = RandomCodeMethod.extend({
    template:'#random_code_mail-method'
});

var Esupnfc = Vue.extend({
template:'#esupnfc-method'
});

var UserDashboard = Vue.extend({
    props: {
        'messages': Object,
        'methods': Object,
        'user': Object,
        'currentmethod': String,
        'get_user': Function
    },
    components: {
        "push": PushMethod,
        "totp": TotpMethod,
        "bypass": BypassMethod,
        "webauthn": WebAuthnMethod,
        "random_code": RandomCodeMethod,
        "random_code_mail":RandomCodeMailMethod,
	"esupnfc":Esupnfc
    },
    template: "#user-dashboard",
    created: function () {
    },
    methods: {
        activate: function (method) {
            switch (method) {
                case 'push':
                    this.askPushActivation(method);
                    break;
                case 'bypass':
                    this.standardActivate(method);
		    this.generateBypass(function () {
                            this.user.methods.bypass.active = false;                           
                        });
                    break;
                case 'random_code':
                    this.standardActivate(method);
                    break;
		case 'random_code_mail':
                    this.standardActivate(method);
                    break;
                case 'totp':
                    this.standardActivate(method);
		    this.generateTotp(function () {
                            this.user.methods.totp.active = false;                           
                        });
                    break;
                case 'webauthn':
                    this.standardActivate(method);
                    break;
                case 'esupnfc':
                    this.standardActivate(method);
                    break;
                default:
                    /** **/                    
                    this.user.methods[method].active = true;
                    break;
            }
        },
        askPushActivation: function (method) {
            this.user.methods.push.askActivation = true;
	    this.user.methods.push.active = true;
            //ajax
            $.ajax({
                method: "PUT",
                url: "api/push/activate",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code == "Ok") {
                        this.user.methods.push.activationCode = data.activationCode;
                        this.user.methods.push.qrCode = data.qrCode;
                        this.user.methods.push.api_url = data.api_url;
                    }else Materialize.toast('Erreur interne, veuillez réessayer plus tard.', 3000, 'red darken-1');
                }.bind(this),
                error: function (xhr, status, err) {
                    console.error("api/push/activate", status, err.toString());
                }.bind(this)
            });
        },       
        standardActivate: function (method) {
            $.ajax({
                method: "PUT",
                url: "api/" + method + "/activate",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code != "Ok") {
			this.user.methods[method].active = false;
                        Materialize.toast('Erreur interne, veuillez réessayer plus tard.', 3000, 'red darken-1');
                    } else this.user.methods[method].active = true;
                }.bind(this),
                error: function (xhr, status, err) {
                    console.error("api/"+method+"/activate", status, err.toString());
                }.bind(this)
            });
        },     
        deactivate: function (method) {
	  if (window.confirm(this.messages.api.action.confirm_deactivate)){
           if(this.user.methods[method].askActivation) this.user.methods[method].askActivation=false;	
            $.ajax({
                method: "PUT",
                url: "api/" + method + "/deactivate",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code != "Ok") {
                        Materialize.toast('Erreur interne, veuillez réessayer plus tard.', 3000, 'red darken-1');
                    }
                    else this.user.methods[method].active = false;
                }.bind(this),
                error: function (xhr, status, err) {
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/" + method + "/deactivate", status, err.toString());
                }.bind(this)
            });
	   }
        },
	generateBypassConfirm : function(){
	    if (window.confirm(this.messages.api.action.confirm_generate)) this.generateBypass();
        },
	generateTotpConfirm : function(){
	    if (window.confirm(this.messages.api.action.confirm_generate)) this.generateTotp();
        },
        generateBypass: function (onError) {   
            $.ajax({
                method: "POST",
                url: "api/generate/bypass",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code == "Ok") this.user.methods.bypass.codes = data.codes;
                    else if (typeof(onError) === "function") onError();
                }.bind(this),
                error: function (xhr, status, err) {
                    if (typeof(onError) === "function") onError();
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/generate/bypass", status, err.toString());
                }.bind(this)
            });
        },
        generateTotp: function (onError) {
            $.ajax({
                method: "POST",
                url: "api/generate/totp",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code == "Ok") {
                        this.user.methods.totp.message = data.message;
                        this.user.methods.totp.qrCode = data.qrCode;
                        this.user.methods.totp.uid = data.uid;
                    } else if (typeof(onError) === "function") onError();
                }.bind(this),
                error: function (xhr, status, err) {
                    if (typeof(onError) === "function") onError();
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/generate/totp", status, err.toString());
                }.bind(this)
            });
        }
    }
});

/** Manager **/
var UserView = Vue.extend({
    props: {
        'user': Object,
        'methods': Object,
        'messages': Object,
        "get_user": Function
    },
    components: {
        "push": PushMethod,
        "totp": TotpMethod,
        "bypass": BypassMethod,
        "webauthn": WebAuthnMethod,
        "random_code": RandomCodeMethod,
        "random_code_mail":RandomCodeMailMethod,
	"esupnfc":Esupnfc
    },
    data: function () {
        return {
            "switchPushEvent": MouseEvent
        }
    },
    template: '#user-view',
    methods: {
        activate: function (method) {
            switch (method) {
                case 'push':
                    this.askPushActivation(method);
                    break;
                case 'bypass':
                    this.standardActivate(method);
		    this.generateBypass(function () {
                            this.user.methods.bypass.active = false;
                        })
                    break;
                case 'webauthn':
                    this.standardActivate(method);
                    break;
                case 'random_code':
                    this.standardActivate(method);
                    break;
		case 'random_code_mail':
                    this.standardActivate(method);
                    break;
                case 'totp':
                    this.standardActivate(method);
		    this.generateTotp(function () {
                            this.user.methods.totp.active = false;
                        });
                    break;
                case 'esupnfc':
                    this.standardActivate(method);
                    break;
                default:
                    /** **/
                    this.user.methods[method].active = true;
                    break;
            }
        },
        askPushActivation: function () {
            this.user.methods.push.askActivation = true;
	    this.user.methods.push.active = true;   
            //ajax
            $.ajax({
                method: "PUT",
                url: "api/admin/" + this.user.uid + "/push/activate",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code == "Ok") {
                        this.user.methods.push.activationCode = data.activationCode;
                        this.user.methods.push.qrCode = data.qrCode;
                        this.user.methods.push.api_url = data.api_url;
                    }else Materialize.toast('Erreur interne, veuillez réessayer plus tard', 3000, 'red darken-1');
                }.bind(this),
                error: function (xhr, status, err) {
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/admin/" + this.user.uid + "/push/activate", status, err.toString());
                }.bind(this)
            });
        },        
        standardActivate: function (method) {
            $.ajax({
                method: "PUT",
                url: "api/admin/" + this.user.uid + "/" + method + "/activate",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code != "Ok") {
                        this.user.methods[method].active = false;
                        Materialize.toast('Erreur interne, veuillez réessayer plus tard', 3000, 'red darken-1');
                    }else this.user.methods[method].active = true;
                }.bind(this),
                error: function (xhr, status, err) {
                    this.user.methods[method].active = false;
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/admin/" + this.user.uid + "/"+method+"/activate", status, err.toString());
                }.bind(this)
            });
        },            
        deactivate: function (method) {
         if (window.confirm(this.messages.api.action.confirm_deactivate)){
            if(this.user.methods[method].askActivation) this.user.methods[method].askActivation=false;	
            $.ajax({
                method: "PUT",
                url: "api/admin/" + this.user.uid + "/" + method + "/deactivate",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code == "Ok") this.user.methods[method].active = false;
                    else {
                        Materialize.toast('Erreur interne, veuillez réessayer plus tard', 3000, 'red darken-1');
                        this.user.methods[method].active = true;
                    }
                }.bind(this),
                error: function (xhr, status, err) {
                    this.user.methods[method].active = true;
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/admin/" + this.user.uid + "/" + method + "/activate", status, err.toString());
                }.bind(this)
            });
	  }
        },
	generateBypassConfirm : function(){
	    if (window.confirm(this.messages.api.action.confirm_generate)) this.generateBypass();
        },
	generateTotpConfirm : function(){
	    if (window.confirm(this.messages.api.action.confirm_generate)) this.generateTotp();
        },
        generateBypass: function (onError) {       
            $.ajax({
                method: "POST",
                url: "api/admin/generate/bypass/" + this.user.uid,
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code == "Ok") this.user.methods.bypass.codes = data.codes;
                    else if (typeof(onError) === "function") onError();
                }.bind(this),
                error: function (xhr, status, err) {
                    if (typeof(onError) === "function") onError();
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/admin/generate/bypass/" + this.user.uid, status, err.toString());
                }.bind(this)
            });
        },
        generateTotp: function (onError) {
            $.ajax({
                method: "POST",
                url: "api/admin/generate/totp/" + this.user.uid,
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code == "Ok") {
                        this.user.methods.totp.message = data.message;
                        this.user.methods.totp.qrCode = data.qrCode;
                        this.user.methods.totp.uid = data.uid;
                    } else if (typeof(onError) === "function") onError();
                }.bind(this),
                error: function (xhr, status, err) {
                    if (typeof(onError) === "function") onError();
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/admin/generate/bypass/" + this.user.uid, status, err.toString());
                }.bind(this)
            });
        },
    }
});

var ManagerDashboard = Vue.extend({
    props: {
        'methods': Object,
        'messages': Object,
        //'show':Boolean,
    },
    components: {
        "user-view": UserView
    },
    data: function () {
        return {
            suggestions: [],
            user: {
                uid: String,
                methods: Object,
                transports: Object
            },
            uids: Array,
            isHidden: true,
            textButton: String,
        }
    },
    created: function () {
        this.getUsers();
    },
    updated: function () {
        this.getUsers();
    },
    methods: {
        isInArray: function(value, array) {
            return array.indexOf(value) > -1;
        },

        suggest: function (event) {
            this.suggestions = [];
            if (event.target.value !== "") {
                for (uid in this.uids) {
                    this.isHidden= true;
                    
                    if (this.uids[uid].includes(event.target.value)) {
                        this.suggestions.push(this.uids[uid]);
                    }
                }
            }
            if(this.isInArray($('#autocomplete-input').val(), this.suggestions)){
                this.isHidden= false;
                this.textButton = "chercher";
            }
            else{
                this.textButton = "ajouter";
                this.isHidden= false;
            }
            if ($('#autocomplete-input').val() === "")
                this.isHidden = true;
        },

        search: function (event) {
            if ($('#autocomplete-input').val() !== "" && this.suggestions.includes($('#autocomplete-input').val())) {
                this.getUser($('#autocomplete-input').val());
                $('#autocomplete-input').val('');
                this.isHidden = true;
                this.show = false;//
            }
        },

        addUser: function (event) {
            if ($('#autocomplete-input').val() !== "") {
                this.getUser($('#autocomplete-input').val());
                $('#autocomplete-input').val('');
                this.isHidden = true;
                this.getUsers();
                Materialize.toast('utilisateur '+$('#autocomplete-input').val()+' ajouté avec succès', 3000, 'green darken-1');
            }
        },

        getUsers: function () {
            $.ajax({
                url: "api/admin/users",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    this.setUsers(data);
                }.bind(this),
                error: function (xhr, status, err) {
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/admin/users", status, err.toString());
                }.bind(this)
            });
        },

        setUsers: function (data) {
            this.uids = data.uids;
        },

        getUser: function (uid) {
            $.ajax({
                url: "api/admin/user/" + uid,
                dataType: 'json',
                cache: false,
                success: function (data) {
                    data.uid = uid;
                    this.setUser(data);
                }.bind(this),
                error: function (xhr, status, err) {
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/admin/user/" + uid, status, err.toString());
                }.bind(this)
            });
        },
        setUser: function (data) {
            this.user = {
                uid: data.uid,
                methods: data.user.methods,
                transports: data.user.transports
            }
        }
    },
    template: '#manager-dashboard'
});

/** Admin **/
var AdminDashboard = Vue.extend({
    props: {
        'messages': Object,
        'methods': Object
    },
    template: '#admin-dashboard',
    methods: {
        activate: function (event) {
            event.target.checked = true;
            $.ajax({
                method: "PUT",
                url: "api/admin/" + event.target.name + "/activate",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code != "Ok") {
                        event.target.checked = false;
                        Materialize.toast('Erreur interne, veuillez réessayer plus tard.', 3000, 'red darken-1');
                    } else {
                        this.methods[event.target.name].activate = true;
                    }
                }.bind(this),
                error: function (xhr, status, err) {
                    event.target.checked = false;
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/admin/" + event.target.name + "/activate", status, err.toString());
                }.bind(this)
            });
        },
        deactivate: function (event) {
            event.target.checked = false;
            $.ajax({
                method: "PUT",
                url: "api/admin/" + event.target.name + "/deactivate",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code != "Ok") {
                        this.methods[event.target.name].activate = true;
                        Materialize.toast('Erreur interne, veuillez réessayer plus tard.', 3000, 'red darken-1');
                    } else this.methods[event.target.name].activate = false;
                }.bind(this),
                error: function (xhr, status, err) {
                    event.target.checked = true;
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/admin/" + event.target.name + "/deactivate", status, err.toString());
                }.bind(this)
            });
        },
        activateTransport: function (method, transport) {
            event.target.checked = true;
            $.ajax({
                method: "PUT",
                url: "api/admin/" + method + "/transport/" + transport + "/activate",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code != "Ok") {
                        event.target.checked = false;
                        Materialize.toast('Erreur interne, veuillez réessayer plus tard.', 3000, 'red darken-1');
                    } else {
                        this.methods[method].transports.push(transport);
                    }
                }.bind(this),
                error: function (xhr, status, err) {
                    event.target.checked = false;
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/admin/" + method + "/transport/" + transport + "/activate", status, err.toString());
                }.bind(this)
            });
        },
        deactivateTransport: function (method, transport) {
            event.target.checked = false;
            $.ajax({
                method: "PUT",
                url: "api/admin/" + method + "/transport/" + transport + "/deactivate",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    if (data.code != "Ok") {
                        event.target.checked = true;
                        Materialize.toast('Erreur interne, veuillez réessayer plus tard', 3000, 'red darken-1');
                    } else {
                        var index = this.methods[method].transports.indexOf(transport);
                        if (index > (-1)) this.methods[method].transports.splice(index, 1);
                    }
                }.bind(this),
                error: function (xhr, status, err) {
                    event.target.checked = true;
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/admin/" + method + "/transport/" + transport + "/deactivate", status, err.toString());
                }.bind(this)
            });
        },
    }
});

/** Admin **/
var Home = Vue.extend({
    props: {
        messages: Object,
        'methods': Object,
    },
    methods: {
        navigate: function (name) {
            document.getElementById(name).click();
        },
    },
    template: '#home-dashboard'
});

/** Main **/
var app = new Vue({
    el: '#app',
    components: {
        "home": Home,
        "preferences": UserDashboard,
        "manager": ManagerDashboard,
        "admin": AdminDashboard
    },
    data: {
        pageTitle: 'Accueil',
        currentView: 'home',
        currentMethod: '',
        methods: {},
        user: {
            uid: '',
            methods: {},
            transports: {}
        },
        users_methods:{},
        uids: [],
        messages: {}
    },
    created: function () {
        this.getMessages();
        this.getUser();
        this.getMethods();
    },
    methods: {
        cleanMethods: function () {
            for (method in this.methods) {
                if (method[0] == '_') delete this.methods[method];
                else {
                    this.methods[method].name = method;
                    this.methods[method].authorize=this.is_authorized(method);
                    if (this.messages.api) {
                        if (this.messages.api.methods[method]) this.methods[method].label = this.messages.api.methods[method].name;
                    }
                }
            }

        },

        navigate: function (event) {
            if (event.target.name == "manager") {
                this.pageTitle = event.target.text;
                this.currentView = 'manager';
            } else if (event.target.name == "admin") {
                this.currentView = 'admin';
                this.pageTitle = event.target.text;
            } else if (event.target.name == "home") {
                this.currentView = 'home';
                this.pageTitle = event.target.text;
            } else {
                this.pageTitle = "Préférences";
                this.currentMethod = event.target.name;
                this.currentView = 'preferences';
            }
            $('a').parent().removeClass('active');
                $('#' + event.target.name).parent().addClass('active');
                if (document.getElementById("sidenav-overlay"))$('#navButton').click();
            this.getUser();
        },

        getUser: function () {
            $.ajax({
                url: "api/user",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    this.setUser(data);
                }.bind(this),
                error: function (xhr, status, err) {
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/user", status, err.toString());
                }.bind(this)
            });
        },

        setUser: function (data) {
            this.user.uid = data.uid;
            this.user.methods = data.user.methods;
            this.user.transports = data.user.transports;
        },
        getMethods: function () {
            $.ajax({
                url: "api/methods",
                dataType: 'json',
                cache: false,
                success: function (data) {
                    $.ajax({
                        url: "manager/users_methods",
                        dataType: 'json',
                        cache: false,
                        success: function (users_methods) {
                            this.users_methods=users_methods;
                            this.setMethods(data);
                        }.bind(this),
                        error: function (xhr, status, err) {
                            Materialize.toast(err, 3000, 'red darken-1');
                            console.error("manager/users_methods", status, err.toString());
                        }.bind(this)
                    });
                }.bind(this),
                error: function (xhr, status, err) {
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/methods", status, err.toString());
                }.bind(this)
            });
        },
        setMethods: function (data) {
            this.methods = data.methods;
            this.cleanMethods();
        },
        getMessages: function (language) {
            var query = '';
            if(language)query="/"+language;
            $.ajax({
                url: "api/messages" + query,
                dataType: 'json',
                cache: false,
                success: function (data) {
                    this.setMessages(data);
                }.bind(this),
                error: function (xhr, status, err) {
                    Materialize.toast(err, 3000, 'red darken-1');
                    console.error("api/messages", status, err.toString());
                }.bind(this)
            });
        },
        setMessages: function (data) {
            this.messages = data;
            this.cleanMethods();
        },
        checkAcl: function(method,acl){
            var result=false;
            var not="";
            if(acl=="deny"){
                result=true;
                not="not ";
            }
            if(this.users_methods[method][acl] && this.users_methods.user.attributes) {
                for(attr in this.users_methods[method][acl]) {
                    //console.debug("this.users_methods["+method+"]["+acl+"]: "+JSON.stringify(this.users_methods[method][acl]));
                    //console.debug("User: "+JSON.stringify(this.users_methods.user));
                    if(this.users_methods.user.attributes[attr]) {
                        for(valueAttr of this.users_methods[method][acl][attr]) {
                            if(this.users_methods.user.attributes[attr].includes(valueAttr)){
                                //console.debug("{"+method+"} method is "+not+"displayed because user attribute {"+attr+"} contains {"+valueAttr+"}");
                                return !result;
                            }
                        }
                    }
                }
            }
            return result;
        },
        is_authorized: function(method){
            var result=true; //par défaut, la méthode est autorisée
            if(this.users_methods && this.users_methods[method]) {
                for(acl in this.users_methods[method]) {//pour une méthode, la priorité porte sur le dernier acl [allow|deny].
                    result=this.checkAcl(method,acl);
                }
            }
            return result;
        }
    }
})

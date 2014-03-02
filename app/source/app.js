enyo.kind({
	name: "App",
	kind: enyo.VFlexBox,
	components: [
		{kind: "AppMenu", name: "appMenu", components: [ 
			{ caption: $L("About"), onclick: "onAbout" }]},
		{kind: "About", name: "about", onclick: "aboutClick"},
		{kind: "PageHeader", components: [
			{content: "Remember The Milk"}
		]},
		{ name: "wv", kind: "Pane", flex: 1, components: [
			{ kind: "WebView" }
		]},
		{ kind: "Pane", className: "log", components: [
			{flex: 1, kind: "Scroller", className: "out", components: [
				{name:"targOutput"}
			]}
		]},
		{ name: "launchApp", kind: "PalmService", service: "palm://com.palm.applicationManager/", method: "launch", onSuccess: "launchFinished", onFailure: "launchFail", subscribe: false },
		{ name: "activCall", kind: "PalmService", service: "palm://com.palm.activitymanager/", method: "create", onSuccess: "activFinished", onFailure: "activFail" },
		{
			name: "db", kind: "DbService", dbKind: "net.webos24.synergy.rtm.tasks.app:1", onFailure: "dbFailure", components: [
				{ name: "delKind", method: "delKind", onSuccess: "delKindSuccess"},
				{ name: "putKind", method: "putKind", onSuccess: "putKindSuccess"},
				{ name: "putPermissions", method: "putPermissions", onSuccess: "putPermissionsSuccess"},
				{ name: "getToken", method: "find", onSuccess: "getTokenSuccess"},
				{ name: "putToken", method: "put", onSuccess: "putTokenSuccess"}
			]
		},
		{ kind: "ModalDialog", name: "pref", style: "width: 320px;", caption: $L("Preferences"), components:[
			{ kind: "RowGroup", components: [ 
				{ kind: "VFlexBox", components : [ 
					{ className: "label", content: "Sync interval:"}, { kind: "ListSelector", name: "int", items: [{ caption: "5 minutes", value: "5m"}, { caption: "30 minutes", value: "30m"}, { caption: "1 hour", value: "1h"}, { caption: "3 hours", value: "3h"}, { caption: "6 hours", value: "6h"}, { caption: "12 hours", value: "12h"}, { caption: "1 day", value: "1d"}]}
    			]},
				{ layoutKind: "HFlexLayout", components: [ { kind: "Button", caption: $L("Ok"), flex: 2/3, className: "enyo-button-dark", onclick: "prefOk"}]}
			]}
		]}
	],

	logData: function(logInfo) {
	    this.$.targOutput.setContent(logInfo + " " + this.$.targOutput.getContent());
	},
    onAbout: function() {
    	this.$.about.init();
    	this.$.about.openAtCenter();
    },
    aboutClick: function() {
    	this.$.about.close();
    },
    onWeb: function(from, msg) {
		console.error('FROM '+from+' #### ' + enyo.json.stringify(msg));
	},
	rendered: function() {
    this.inherited(arguments);
		this.libraries = MojoLoader.require({ name: "foundations", version: "1.0" });
		this.Ajax = this.libraries["foundations"].Comms.AjaxCall;
		this.Future = this.libraries["foundations"].Control.Future;
		this.MD5 = MojoLoader.require({ name: "foundations.crypto", version: "1.0" })["foundations.crypto"].MD5;
		var q = {"query":{"from":"net.webos24.synergy.rtm.tasks.app:1"}};
		this.interval = "5m";
		this.$.webView.setUrl("about:blank");
		this.$.wv.hide();
		this.patchWV();
    this.$.getToken.call(q);
		this.$.targOutput.setContent("Checking token...");
	},
	sign: function(obj) {
		var secret = 'bb65e6edc1303802';
		obj.api_key = '1e7ad8c2b65740b0b63fc83c5864934e';
		obj.format = 'json';
		var keys = Object.keys(obj).toString().split(',').sort(function(a,b){return a.localeCompare(b);});
		var str = secret;
		for(var i=0; i<keys.length; i++)
			str += keys[i] + obj[keys[i]];
		obj.api_sig = this.MD5.hex_md5(str);
	},
	launchFinished: function(inSender, inResponse) {
//		this.$.tb.show();
	},
	launchFail: function(inSender, inResponse) {
		console.error("Launch browser failure: " + enyo.json.stringify(inResponse));
	},
	activFinished: function(inSender, inResponse) {
		this.$.targOutput.setContent("Activity created, interval: " + this.interval + ". You can close this app now. Check Accounts app to make sure you have Remember The Milk account created.");
		this.$.launchApp.call({"id": "com.palm.app.accounts", "params":{}});
	},
	activFail: function(inSender, inResponse) {
		this.$.targOutput.setContent("Activity failure: " + enyo.json.stringify(inResponse));
	},
    putKindSuccess: function(inSender, inResponse) {
		var permObj =[{"type":"db.kind", "object":'net.webos24.synergy.rtm.tasks.app:1', "caller":"net.webos24.synergy.rtm.tasks.service", "operations":{"read":"allow","create":"allow","update":"allow","delete":"allow"}}];
        this.$.putPermissions.call({"permissions":permObj});
    },
    putPermissionsSuccess: function(inSender, inResponse) {
    },
    putTokenSuccess: function(inSender, inResponse) {
		var q = {"query":{"from":"net.webos24.synergy.rtm.tasks.app:1"}};
        this.$.getToken.call(q);
    },
    getTokenSuccess: function(inSender, inResponse) {
		if(inResponse.results[0]!==undefined && inResponse.results[0].token!==undefined) {
			this.$.targOutput.setContent("Validating token...");
			this.token = inResponse.results[0].token;
			this.$.wv.hide();
			this.checkToken();
		} else {
			this.$.targOutput.setContent("Token not found. Login required...");
			setTimeout(this.loginClicked(), 0);
		}
    },
    dbFailure: function(inSender, inError, inRequest) {
		if(inError.errorText.indexOf("kind not registered")==0) {
	        var indexes = [{"name":"token", props:[{"name": "token"}]}];
	        this.$.putKind.call({owner: enyo.fetchAppId(), indexes:indexes});
		} else {
	        console.error(enyo.json.stringify(inError));
		}
    },
	prefOk: function() {
		this.interval = this.$.int.getValue();
		enyo.setCookie('interval', this.$.int.getValue());
		this.$.pref.close();
		this.$.targOutput.setContent("Creating activity...");
		this.$.activCall.call({	"start": true, "replace" : true, "activity": {
			"name": "rtm.sync.activity",
			"description": "sync tasks from remote server",
			"schedule": { "interval": this.interval	},
			"callback": { "method": "palm://net.webos24.synergy.rtm.tasks.service/sync", "params": { "restart": false }	},
	        "type" : { "background" : true, "persist": true }}
		});
	},

	checkToken: function() {
		var url = "https://api.rememberthemilk.com/services/rest/?";
		var obj = {method:'rtm.auth.checkToken', auth_token: this.token};
		this.sign(obj);
		for(var i in obj)
			if(obj.hasOwnProperty(i))
				url += i + '=' + obj[i] + '&';
		console.error(url);
		var f1 = this.Ajax.get(url);
		f1.then(this, function(f) {
			if(f.result.status==200) {
				this.logData(JSON.stringify(f.result.responseJSON));
				if(f.result.responseJSON.rsp.stat == "ok") {
					this.$.webView.setUrl("about:blank");
					this.$.wv.hide();
					this.$.targOutput.setContent("Token for user '" + f.result.responseJSON.rsp.auth.user.username + "' is valid.");
					this.$.pref.validateComponents();
					var int = enyo.getCookie('interval');
					if(int)
						this.$.int.setValue(int);
					this.$.pref.openAtCenter();
				}
			}
		});
	},

	loginClicked: function() {
		var url = "https://api.rememberthemilk.com/services/rest/?";
		var obj = {method:'rtm.auth.getFrob'};
		this.sign(obj);
		for(var i in obj)
			if(obj.hasOwnProperty(i))
				url += i + '=' + obj[i] + '&';
		console.error(url);
		var f1 = this.Ajax.get(url);
		f1.then(this, function(f) {
			if(f.result.status==200) {
				this.logData(JSON.stringify(f.result.responseJSON));
				f.result.frob = f.result.responseJSON.rsp.frob;
				console.error('FROB:'+f.result.frob);
				var url = "http://www.rememberthemilk.com/services/auth/?";
				var obj = {perms:'delete', frob: f.result.frob};
				this.sign(obj);
				for(var i in obj)
					if(obj.hasOwnProperty(i))
						url += i + '=' + obj[i] + '&';
				console.error(url);
				this.frob = f.result.frob;
				this.$.targOutput.setContent("Login with your username/password and Authorize API Access.");
				this.$.wv.show();
				this.$.webView.setUrl(url);
				setTimeout(this.watchToken.bind(this, url), 10000);
			}
		});
	},
	
	tokenClicked: function() {
		var url = "https://api.rememberthemilk.com/services/rest/?";
		var obj = {method:'rtm.auth.getToken', frob: this.frob};
		this.sign(obj);
		for(var i in obj)
			if(obj.hasOwnProperty(i))
				url += i + '=' + obj[i] + '&';
//		console.error(url);
		var f1 = this.Ajax.get(url);
		f1.then(this, function(f) {
			if(f.result.status==200) {
				console.error('RTM RESULT getToken:' + JSON.stringify(f.result.responseJSON));
				if(f.result.responseJSON.rsp.stat==="fail" && f.result.responseJSON.rsp.err.code==="101") {
					setTimeout(this.tokenClicked.bind(this), 3000);
				} else {
					this.$.targOutput.setContent("Got token...");
					this.token = f.result.responseJSON.rsp.auth.token;
					var obj1 = { _kind: "net.webos24.synergy.rtm.tasks.app:1", token: this.token };
					var objs = [obj1];
					this.$.putToken.call({objects: objs});
				}
			}
		});
	},

	watchToken: function(url) {
		if(this.watchUrl===undefined) {
			this.watchUrl = url;
		}
		setTimeout(this.tokenClicked.bind(this), 1000);
	},

	patchWV: function() {
		if(enyo.fetchDeviceInfo && enyo.fetchDeviceInfo().platformVersionMajor <= 2) {
			var orig = enyo.BasicWebView.prototype._connect;
			enyo.BasicWebView.prototype._connect = function() {
				orig.apply(this, arguments);
				this.serverConnected();
			};
			enyo.WebView.prototype.clickHandler = function(s, e) {
				var x = e.offsetX * (window.zoomFactor ? window.zoomFactor : 1);
				var y = e.offsetY * (window.zoomFactor ? window.zoomFactor : 1);
				this.$.view.node.clickAt(x, y, 0);
			};
		}	
	}
});


var Foundations = IMPORTS.foundations;
var DB = Foundations.Data.DB;
var Future = Foundations.Control.Future;
var PalmCall = Foundations.Comms.PalmCall;
var AjaxCall = Foundations.Comms.AjaxCall;

var MD5 = IMPORTS["foundations.crypto"].MD5;
var token = undefined;
var tasklistid = undefined;

if (typeof require === 'undefined') {
  require = IMPORTS.require;
}
var ServiceLog = { //will need to worry about turning this off in production
	log: function(msg){
		this.logger.error("RTM log: " + this.concat(arguments));
	},
	error: function(msg){
		this.logger.error("RTM err: " + this.concat(arguments));
	},
	warn: function(msg){
		this.logger.error("RTM warn: " + this.concat(arguments));
	},
	concat: function(args){
	        return Array.prototype.slice.call(args).join(" ");
	},
	logger: require('pmloglib')
};

var	RTM = {
	sign: function(obj) {
		var secret = 'bb65e6edc1303802';
		obj.api_key = '1e7ad8c2b65740b0b63fc83c5864934e';
		obj.format = 'json';
		var keys = Object.keys(obj).toString().split(',').sort(function(a,b){return a.localeCompare(b);});
		var str = secret;
		for(var i=0; i<keys.length; i++)
			str += keys[i] + obj[keys[i]];
		obj.api_sig = MD5.hex_md5(str);
	}
};

var validatorAssistant = function(future) {};
validatorAssistant.prototype.run = function(future) {  
	var args = this.controller.args;  
	ServiceLog.log("validatorAssistant args =" + JSON.stringify(args));
	var f1 = PalmCall.call("palm://com.palm.db/", "find", {"query":{"from":"net.webos24.synergy.rtm.tasks.app:1"}});
	f1.then( function(f) {
		if(f.result===undefined || f.result.returnValue!==true || f.result.results[0]===undefined || f.result.results[0].token===undefined) {
			PalmCall.call("palm://com.palm.applicationManager", "open", { id: 'net.webos24.synergy.rtm.tasks.app', params: {} });
			future.result = { returnValue: false, errorCode: "500_SERVER_ERROR" };
		} else {
			token = f.result.results[0].token;
			var url = "https://api.rememberthemilk.com/services/rest/?";
			var obj = {method:'rtm.auth.checkToken', auth_token: token};
			RTM.sign(obj);
			for(var i in obj)
				if(obj.hasOwnProperty(i))
					url += i + '=' + obj[i] + '&';
			var f1 = AjaxCall.get(url);
			f1.then(this, function(f) {
				if(f.result.status!==200 || f.result.responseJSON.rsp.stat != "ok" || f.result.responseJSON.rsp.auth.user.username.toLowerCase()!==args.username.toLowerCase()) {
					future.result = { returnValue: false, errorCode: "401_UNAUTHORIZED" };
				} else {
					future.result = { returnValue: true };
				}
			});
		}
	});
};

var onCapabilitiesChangedAssistant = function(future){};
onCapabilitiesChangedAssistant.prototype.run = function(future) { 
    var args = this.controller.args; 
    ServiceLog.log("onCapabilitiesChanged args =" + JSON.stringify(args));   
	future.result = { returnValue: true };
};

var onCredentialsChangedAssistant = function(future){};
onCredentialsChangedAssistant.prototype.run = function(future) { 
    var args = this.controller.args; 
    ServiceLog.log("onCredentialsChanged args =" + JSON.stringify(args));    
	future.result = { returnValue: true };
};

var onCreateAssistant = function(future){};
onCreateAssistant.prototype.run = function(future) {  

    var args = this.controller.args;
    ServiceLog.log("onCreateAssistant args =" + JSON.stringify(args));
	future.result = { returnValue: true };
    ServiceLog.log("FIRST SYNC");   
	PalmCall.call("palm://net.webos24.synergy.rtm.tasks.service/", "sync", { "first": true });
};

var onDeleteAssistant = function(future){};
onDeleteAssistant.prototype.run = function(future) { 
	var args = this.controller.args;
	ServiceLog.log("onDeleteAssistant args =" + JSON.stringify(args));    

	PalmCall.call("palm://com.palm.db/", "del", {"query":{"from":"net.webos24.synergy.rtm.tasks.db:1"}});
	PalmCall.call("palm://com.palm.db/", "del", {"query":{"from":"net.webos24.synergy.rtm.tasks.list:1"}});
	PalmCall.call("palm://com.palm.db/", "del", {"query":{"from":"net.webos24.synergy.rtm.tasks.transport:1"}});
	PalmCall.call("palm://com.palm.db/", "del", {"query":{"from":"net.webos24.synergy.rtm.tasks.app:1"}});
	future.result = { returnValue: true };
};

var onEnabledAssistant = function(future){};
onEnabledAssistant.prototype.run = function(future) {  
    var args = this.controller.args;
    ServiceLog.log("onEnabledAssistant args =" + JSON.stringify(args));
    if (args.enabled === true) {
		var item = { _kind: "net.webos24.synergy.rtm.tasks.list:1", accountId: args.accountId, name: "RTM", show: "all", order: "position" };
		PalmCall.call("palm://com.palm.db/", "put", { "objects": [item] }).then( function(f) {
			ServiceLog.log("RTM list:" + JSON.stringify(f.result));
		});
	}
    future.result = {returnValue: true};
};

var syncAssistant = function(future){};
syncAssistant.prototype.run = function(future) { 

	var args = this.controller.args;
	ServiceLog.log("syncAssistant args =" + JSON.stringify(args));

	if(!args.first && (args["$activity"]===undefined || args["$activity"].activityId===undefined)) {
		ServiceLog.log("NO ACTIVITY");
		future.result = {returnValue: false, rsp: {"err":"no activity"}};
	} else {
		tasklistid = null;
		PalmCall.call("palm://com.palm.db/", "find", {"query":{ "from":"net.webos24.synergy.rtm.tasks.list:1"}}).then( function(f) {
			if(f.result && f.result.returnValue && f.result.results[0])
				tasklistid = f.result.results[0]._id;
			token = undefined;
			PalmCall.call("palm://com.palm.db/", "find", {"query":{"from":"net.webos24.synergy.rtm.tasks.app:1"}}).then( function(f) {
				if(f.result && f.result.returnValue && f.result.results[0])
					token = f.result.results[0].token;
				if(token===undefined) {
					ServiceLog.log("NO TOKEN");
					PalmCall.call("palm://com.palm.activitymanager/", "stop", {"activityId": args["$activity"].activityId, "restart": false});
					future.result = {returnValue: false, rsp: {"err":"no token"}};
				} else {
					var url = "https://api.rememberthemilk.com/services/rest/?";
					var obj = {method:'rtm.tasks.getList', auth_token: token};
					RTM.sign(obj);
					for(var i in obj)
						if(obj.hasOwnProperty(i))
							url += i + '=' + obj[i] + '&';
					ServiceLog.log(url);
					var f1 = AjaxCall.get(url);
					f1.then(function(f) {
						if(f.result.status==200) {
//							ServiceLog.log(JSON.stringify(f.result.responseJSON));
							if(f.result.responseJSON.rsp && f.result.responseJSON.rsp.stat==="ok" && f.result.responseJSON.rsp.tasks) {
								var list = f.result.responseJSON.rsp.tasks.list;
								var server = [];
								for(var i=0; i<list.length; i++) {
									var listid = list[i].id;
									var taskseries = list[i].taskseries || [];
									if(taskseries.length===undefined)
										taskseries = [taskseries];
									for(var x=0; x<taskseries.length; x++) {
										var name = taskseries[x].name;
										var notes = taskseries[x].notes.note || [];
										if(notes.length===undefined)
											notes = [notes];
										var task = taskseries[x].task;
										var taskid = task.id;
										var priority = task.priority;
										if(priority==='N')
											priority = 2;
										var completed = task.completed;
										var deleted = task.deleted;
										var due = task.due || "";
										due = task.has_due_time==="1" ? new Date(due.substr(0,4), Number(due.substr(5,2)) - 1, due.substr(8,2), due.substr(11,2), due.substr(14,2), due.substr(17,2)) : new Date(due.substr(0,4), Number(due.substr(5,2)) - 1, due.substr(8,2), 12, 0, 0);
//										ServiceLog.log("id: " + taskid + ", name: " + name + ", due: " + due.valueOf() + ", priority: " + priority + ", completed: " + completed + ", notes: " + notes.length);
										var allnotes = "";
										for(var j=0; j<notes.length; j++)
											allnotes += notes[j].modified.replace(/[T].+/,'') + ": " + (notes[j].title==="" ? "\n" : notes[j].title + "\n\n") + notes[j].$t + "\n";
										server.push({_kind: "net.webos24.synergy.rtm.tasks.db:1", _id: taskid, taskListId: tasklistid, completed: completed!=="", notes: allnotes, priority: priority, subject: name, dueDate: ((task.due && task.due.length>0) ? due.valueOf() : null)});
									}
								}
								var local = [];
								PalmCall.call("palm://com.palm.db/", "find", { "query":{ "from":"net.webos24.synergy.rtm.tasks.db:1"}}).then( function(f) {
									if(f.result && f.result.returnValue && f.result.results.length)
										local = f.result.results;
									var toPut = [];
									var toDel = [];
									for(var k=0; k<server.length; k++) {
										var src = server[k];
										toPut.push(src);
										for(var l=0; l<local.length; l++) {
											var dst = local[l];
											if(src._id===dst._id) {
												if(src.taskListId===dst.taskListId && src.completed===dst.completed && src.notes===dst.notes && src.priority===dst.priority && src.subject===dst.subject && src.dueDate===dst.dueDate) {
													local.splice(l, 1);
													var same = toPut.pop();
												} else {
													toDel.push(src._id);
												}
												break;
											}              
										}
									}
//									ServiceLog.log("toPut:" + JSON.stringify(toPut));
//									ServiceLog.log("toDel:" + JSON.stringify(toDel));
									var ops = [];
									for(var d=0; d<toDel.length; d++)
										ops.push({"method":"del", "params": { "query": { "from": "net.webos24.synergy.rtm.tasks.db:1", "where": [{ "prop":"_id", "op":"=", "val":toDel[d]}]}}});
									ops.push({"method":"put", "params": { "objects": toPut }});
									PalmCall.call("palm://com.palm.db/", "batch", {"operations": ops}).then( function(f) {
//										ServiceLog.log("OPERATIONS:" + JSON.stringify(f.result));
										if(f.result.returnValue === true)
											future.result = {returnValue: true};
									});
								});
							} else {
								future.result = {returnValue: false, rsp: f.result.responseJSON};
							}
						}
					});
				}
			});
		});
	}
	if(future.result===undefined)
		future.result = {returnValue: true, rsp: { "err": "xx"}};
	if(!args.first && args["$activity"]!==undefined && args["$activity"].activityId!==undefined)
		PalmCall.call("palm://com.palm.activitymanager/", "complete", {"activityId": args["$activity"].activityId, "restart": true, "callback": { "method": "palm://net.webos24.synergy.rtm.tasks.service/sync", "params": { "restart": true }}});
};


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
	},
	
	compare: function(l, r) {
	    var ret = {changed: 0};
        var ln = l.notes.replace(/\n+#[0-9]+#[0-9]+#[0-9a-f]+$/,'');
        var rn = r.notes.replace(/\n+#[0-9]+#[0-9]+#[0-9a-f]+$/,'');
        if( 
            l.completed === r.completed && 
            l.priority === r.priority && 
            l.dueDate === r.dueDate &&
            l.subject === r.subject && 
            ln === rn
          )
            return ret;
        var h1 = l.notes.substr(-32);
        var x = (l.completed?"Y":"N") + l.priority + l.dueDate + l.subject + ln;
        var y = (r.completed?"Y":"N") + r.priority + r.dueDate + r.subject + rn;
        var h2 = MD5.hex_md5(y);
//ServiceLog.log("  LOCAL: " + l._id + " OLD " + h1+ " : " + encodeURIComponent(x));
//ServiceLog.log(" REMOTE: " + r._id + " NEW " + h2+ " : " + encodeURIComponent(y));
        ret.changed = h1===h2 ? 1 : -1;
ServiceLog.log(h1===h2 ? "CHANGED LOCALLY " + l._id : "CHANGED ON SERVER " + r._id);
        if(h1===h2)
            ret.md5 = MD5.hex_md5(x);
        if(l.completed!==r.completed)
            ret.completed = true;
        if(l.priority!==r.priority)
            ret.priority = true;
        if(l.dueDate!==r.dueDate)
            ret.date = true;
        if(l.subject!==r.subject)
            ret.subject = true;
        if(ln!==rn)
            ret.notes = true;
        return ret;
    },
    
    append: function(obj, tsId, lId) {
        var n = obj.notes.replace(/\n+#[0-9]+#[0-9]+#[0-9a-f]+$/,'');
        var x = (obj.completed?"Y":"N") + obj.priority + obj.dueDate + obj.subject + n;
        var h = MD5.hex_md5(x);
//ServiceLog.log(" SERVER: " + obj._id + " MD5 " + h + " : " + encodeURIComponent(x));
        var a = "\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n\n#" + tsId + '#' + lId + '#' + h;
        obj.notes += a;
    }
};

var validatorAssistant = function(future) {};
validatorAssistant.prototype.run = function(future) {  
	var args = this.controller.args;  
//	ServiceLog.log("validatorAssistant args =" + JSON.stringify(args));
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

    var modifyTask = function(method, timeline, list_id, taskseries_id, task_id, keys, values) {
        url = "https://api.rememberthemilk.com/services/rest/?";
        obj = {method: 'rtm.tasks.' + method, auth_token: token, timeline: timeline, list_id: list_id, taskseries_id: taskseries_id, task_id: task_id};
        if(keys!==undefined && values!==undefined) {
            for(var i=0; i<keys.length && i<values.length; i++)
                obj[keys[i]] = values[i];
        }
        RTM.sign(obj);
        for(var i in obj)
            if(obj.hasOwnProperty(i))
                url += i + '=' + encodeURIComponent(obj[i]) + '&';
//ServiceLog.log(url);
        var fmt = AjaxCall.get(url);
        fmt.then(function(f) {
            if(f.result.status==200) {
                if(f.result.responseJSON && f.result.responseJSON.rsp && f.result.responseJSON.rsp.stat==="ok") {
                } else {
                    ServiceLog.log("UPDATE ERROR: Task: " + task_id + "; JSON: " + JSON.stringify(f.result.responseJSON));
                }
            } else {
                ServiceLog.log("STATUS ERROR: Task: " + task_id + "; status: " + f.result.status);
            }
        });
    }

	var args = this.controller.args;
//	ServiceLog.log("syncAssistant args =" + JSON.stringify(args));

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
//					ServiceLog.log(url);
					var f1 = AjaxCall.get(url);
					f1.then(function(f) {
						if(f.result.status==200) {
//						    var xxx = JSON.stringify(f.result.responseJSON);
//							for(var xx=0; xx<xxx.length; xx+=800)
//							     ServiceLog.log("RTM GOTLIST " + xx + " :" + xxx.substr(xx, 800));
							if(f.result.responseJSON.rsp && f.result.responseJSON.rsp.stat==="ok" && f.result.responseJSON.rsp.tasks) {
								var list = f.result.responseJSON.rsp.tasks.list;
								var server = [];
								for(var i=0; i<list.length; i++) {
									var listid = list[i].id;
									var taskseries = list[i].taskseries || [];
									if(taskseries.length===undefined)
										taskseries = [taskseries];
									for(var x=0; x<taskseries.length; x++) {
									    var tsid = taskseries[x].id;
										var name = taskseries[x].name;
										var notes = taskseries[x].notes.note || [];
										if(notes.length===undefined)
											notes = [notes];
										var tasks = taskseries[x].task || [];
										if(tasks.length===undefined)
										  tasks = [tasks];
										for(var t=0; t<tasks.length; t++){
    										var task = tasks[t];
    										var taskid = task.id;
    										var priority = task.priority;
    										if(priority==='N')
    											priority = '2';
    										var completed = task.completed;
    										var deleted = task.deleted;
    										var due = task.due || "";
    										due = task.has_due_time==="1" ? new Date(due.substr(0,4), Number(due.substr(5,2)) - 1, due.substr(8,2), due.substr(11,2), due.substr(14,2), due.substr(17,2)) : new Date(due.substr(0,4), Number(due.substr(5,2)) - 1, due.substr(8,2), 12, 0, 0);
    										var allnotes = "";
    										for(var j=0; j<notes.length; j++)
    											allnotes += '['+(j+1)+'] '+(notes[j].title==="" ? "" : notes[j].title + "\n") + notes[j].$t + "\n";
                                            var obj = {_kind: "net.webos24.synergy.rtm.tasks.db:1", _id: taskid, taskListId: tasklistid, completed: completed!=="", notes: allnotes.replace(/\s+$/,''), priority: Number(priority), subject: name, dueDate: ((task.due && task.due.length>0) ? due.valueOf() : null)};
    										RTM.append(obj, tsid, listid);
    										server.push(obj);
										}
									}
								}
								var local = [];
								PalmCall.call("palm://com.palm.db/", "find", { "query":{ "from":"net.webos24.synergy.rtm.tasks.db:1"}}).then( function(f) {
									if(f.result && f.result.returnValue && f.result.results.length)
										local = f.result.results;
									var toPut = [];
									var toDel = [];
									var toSend = [];
									for(var k=0; k<server.length; k++) {
										var src = server[k];
										if(local.length===0)
										  toPut.push(src);
										for(var l=0; l<local.length; l++) {
											var dst = local[l];
											if(src._id===dst._id) {
												local.splice(l, 1);
											    var res = RTM.compare(dst, src);
											    if(res.changed===-1 || res.changed===1) {
											        toDel.push(src._id);
                                                    if(res.changed===1) {
           												toSend.push({obj:dst, diff: res});												
                                                        src.completed = dst.completed;
                                                        src.priority = dst.priority;
                                                        src.dueDate = dst.dueDate;
                                                        src.subject = dst.subject;
    													src.notes = dst.notes.replace(/[0-9a-f]+$/, res.md5);
                                                    }											        
											        toPut.push(src);
											    }
												break;
											}              
										}
									}
									for(var m=0; m<local.length; m++)
{
  							           toDel.push(local[m]._id);
var dst = local[m];
ServiceLog.log("DELETED ON SERVER: " + dst._id + " " + (dst.completed?"Y":"N") + dst.priority + dst.dueDate + dst.subject + dst.notes.replace(/\n+#[0-9]+#[0-9]+#[0-9a-f]+$/,''));
}
									var ops = [];
									for(var d=0; d<toDel.length; d++)
										ops.push({"method":"del", "params": { "query": { "from": "net.webos24.synergy.rtm.tasks.db:1", "where": [{ "prop":"_id", "op":"=", "val":toDel[d]}]}}});
									ops.push({"method":"put", "params": { "objects": toPut }});
									PalmCall.call("palm://com.palm.db/", "batch", {"operations": ops}).then( function(f) {
//										ServiceLog.log("OPERATIONS:" + JSON.stringify(f.result));
										if(f.result.returnValue === true)
											future.result = {returnValue: true};
									});

                                    if(toSend.length) {
//ServiceLog.log("toSend:" + JSON.stringify(toSend));                                									

                    					url = "https://api.rememberthemilk.com/services/rest/?";
                    					obj = {method:'rtm.timelines.create', auth_token: token};
                    					RTM.sign(obj);
                    					for(var i in obj)
                    						if(obj.hasOwnProperty(i))
                    							url += i + '=' + obj[i] + '&';
//ServiceLog.log(url);
                    					var f2 = AjaxCall.get(url);
                    					f2.then(function(f) {
                    					    if(f.result.status==200) {
                    						  if(f.result.responseJSON.rsp && f.result.responseJSON.rsp.stat==="ok" && f.result.responseJSON.rsp.timeline) {
                    						      var timeline = f.result.responseJSON.rsp.timeline;
                    						      for(var s=0; s<toSend.length; s++) {
                    						          var item = toSend[s].obj;
                    						          var diff = toSend[s].diff;
                                                      var notes = item.notes.replace(/\n+#[0-9]+#[0-9]+#[0-9a-f]+$/,'');
                    						          var appendix = item.notes.substr(notes.length).replace(/\n+#/, '');
                    						          var tsid = appendix.replace(/#.+#[0-9a-f]+$/,'');
                    						          appendix = appendix.substr(tsid.length+1);
                    						          var lid = appendix.replace(/#[0-9a-f]+$/,'');
// ServiceLog.log("timeline:"+timeline+", ts:"+tsid+", l:"+lid+", t:"+item._id+", DIFF:"+ JSON.stringify(diff));
                                                      if(diff.completed)
                                                        modifyTask(item.completed ? 'complete':'uncomplete', timeline, lid, tsid, item._id);
                                                      if(diff.priority)
                                                        modifyTask('setPriority', timeline, lid, tsid, item._id, ['priority'], [item.priority]);
                                                      if(diff.date)
                                                        modifyTask('setDueDate', timeline, lid, tsid, item._id, item.dueDate===null ? [] : ['due'], [new Date(item.dueDate).toISOString()]);
                                                      if(diff.subject)
                                                        modifyTask('setName', timeline, lid, tsid, item._id, ['name'], [item.subject]);
                                                      if(diff.notes)
                                                        modifyTask('notes.add', timeline, lid, tsid, item._id, ['note_title', 'note_text'], ['webOS', notes]);
                    						      }
                                              } else {
                    						      future.result = {returnValue: false, rsp: f.result.responseJSON};
                    						  }
                                            }
                    					});
									}
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

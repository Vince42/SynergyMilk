enyo.kind({
    name: "About",
    kind: "ModalDialog",
	style: "width: 360px; height: 360px;",
    components: [{
        kind: "enyo.VFlexBox",
        className: "enyo-fit",
        components: [
            { kind: "Group", flex: 1, "components": [ { kind: "Control", name: "aboutText", style: "width: 320px; height: 240px; text-align: center;", allowHtml: true } ] }
        ]
    }],

    create: function() {
        this.inherited(arguments);
    },

    init: function() {
	    this.validateComponents();
	    var app = enyo.fetchAppInfo();
        var about = "<br/><b>" + app.title + "</b><br/>" + $L("version") + " " + app.version + "<br/>" + app.about + "<br/>" + app.donate;
        about += "<br/><span style='font-size:11px;'>This product uses the Remember The Milk API<br/>but is not endorsed or certified<br/>by Remember The Milk.</span>";
        this.$.aboutText.setContent(about);
    }
});

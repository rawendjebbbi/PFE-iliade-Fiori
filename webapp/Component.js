sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/Device",
    "project2/model/models"
],
function (UIComponent, Device, models) {
    "use strict";

    return UIComponent.extend("project2.Component", {
        metadata: {
            manifest: "json"
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
            this.setModel(models.createDeviceModel(), "device");

            var oRouter = this.getRouter();
            var sHash = window.location.hash || "";

            if (sHash.indexOf("OrdreReleve") !== -1) {
                oRouter.initialize(true);
                oRouter.navTo("RouteOrdreReleve", {}, true);

            } else if (sHash.indexOf("SaisieReleve") !== -1) {
                oRouter.initialize(true);
                oRouter.navTo("RouteSaisieReleve", {}, true);

            } else if (sHash.indexOf("ValidationDocument") !== -1) {
                oRouter.initialize(true);
                oRouter.navTo("RouteValidation_document", {}, true);

            } else if (sHash.indexOf("Facturation") !== -1) {
                oRouter.initialize(true);
                oRouter.navTo("RouteFacturation", {}, true);

            } else {
                
                oRouter.initialize();
            }
        }
    });
});
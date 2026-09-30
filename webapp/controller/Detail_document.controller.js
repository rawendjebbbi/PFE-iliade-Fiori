sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("project2.controller.Detail_document", {

        onInit: function () {
            this.getView().setModel(new JSONModel({
                busy: false,
                header: {},
                lignes: [],
                lignesAll: [],
                lignesCount: "0"
            }), "viewModel");

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteDetail_document").attachMatched(this._onRouteMatched, this);
        },

       
        _onRouteMatched: function (oEvent) {
            var sRawBelnr = oEvent.getParameter("arguments").Belnr;

            if (!sRawBelnr || sRawBelnr.trim() === "" || sRawBelnr === "—") {
                MessageToast.show("Aucun document sélectionné.");
                return;
            }

            
            var sBelnr = sRawBelnr.replace(/\s/g, "").replace(/^0+/, "") || sRawBelnr;
            sBelnr = sBelnr.padStart(10, "0");

            this._resetViewModel();

            var oModel = this.getView().getModel();
            if (!oModel) {
                MessageBox.error("Modèle OData non disponible.");
                this.getView().getModel("viewModel").setProperty("/busy", false);
                return;
            }

            this._loadDocument(oModel, sBelnr);
        },

        _resetViewModel: function () {
            this.getView().getModel("viewModel").setData({
                busy: true,
                header: {},
                lignes: [],
                lignesAll: [],
                lignesCount: "0"
            });
        },

    
        _loadDocument: function (oModel, sBelnr) {
            var that = this;

            oModel.read("/documentsdecalculSet", {
                filters: [new Filter("Belnr", FilterOperator.EQ, sBelnr)],
                success: function (oData) {
                    if (!oData.results || oData.results.length === 0) {
                        that.getView().getModel("viewModel").setProperty("/busy", false);
                        MessageToast.show("Document introuvable : " + sBelnr);
                        return;
                    }

                    var oResult     = oData.results[0];
                    var sFoundBelnr = oResult.Belnr || sBelnr;

                  
                    that.getView().getModel("viewModel").setProperty("/header", oResult);

                   
                    that._loadDetailLines(oModel, sFoundBelnr);
                },
                error: function (oError) {
                    that.getView().getModel("viewModel").setProperty("/busy", false);
                    var sMsg = "Document introuvable : " + sBelnr;
                    try {
                        var oResp = JSON.parse(oError.responseText);
                        sMsg = (oResp.error && oResp.error.message && oResp.error.message.value) || sMsg;
                    } catch (e) { /* ignore */ }
                    MessageToast.show(sMsg);
                }
            });
        },

       
        _loadDetailLines: function (oModel, sBelnr) {
            var that = this;

            oModel.read("/detailSet", {
                filters: [new Filter("Belnr", FilterOperator.EQ, sBelnr)],
                success: function (oData) {
                    that.getView().getModel("viewModel").setProperty("/busy", false);

                    if (!oData.results || oData.results.length === 0) {
                        that.getView().getModel("viewModel").setProperty("/lignesCount", "0");
                        return;
                    }

                    that._processDetailLines(oData.results);
                },
                error: function () {
                    that.getView().getModel("viewModel").setProperty("/busy", false);
                    MessageToast.show("Impossible de charger les lignes du document.");
                }
            });
        },

       
        _processDetailLines: function (aLines) {
            var oVM = this.getView().getModel("viewModel");

            var aEnriched = aLines.map(function (oLine) {
                var fNet = parseFloat(oLine.Nettobtr) || 0;

                var sQte = "—";
                if (oLine.IAbrmenge !== null && oLine.IAbrmenge !== undefined && String(oLine.IAbrmenge).trim() !== "") {
                    var fQte = parseFloat(oLine.IAbrmenge);
                    sQte = !isNaN(fQte)
                        ? fQte.toLocaleString("fr-FR", { maximumFractionDigits: 4 })
                        : String(oLine.IAbrmenge);
                }

                var sPrix = "—";
                if (oLine.Urpreis !== null && oLine.Urpreis !== undefined && String(oLine.Urpreis).trim() !== "") {
                    var fPrix = parseFloat(oLine.Urpreis);
                    sPrix = !isNaN(fPrix)
                        ? fPrix.toLocaleString("fr-FR", { minimumFractionDigits: 4, maximumFractionDigits: 6 })
                        : String(oLine.Urpreis);
                }

                var sPrixVal = "—";
                if (oLine.Preis !== null && oLine.Preis !== undefined && String(oLine.Preis).trim() !== "") {
                    var fPrixVal = parseFloat(oLine.Preis);
                    sPrixVal = !isNaN(fPrixVal)
                        ? fPrixVal.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 6 })
                        : String(oLine.Preis);
                }

                return {
                    Belzeile : oLine.Belzeile || "",
                    Belzart  : oLine.Belzart  || "",
                    Programm : oLine.Programm || "—",
                    IAbrmenge: sQte,
                    Massbill : oLine.Massbill || "—",
                    Nettobtr : fNet !== 0
                        ? fNet.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "0,00",
                    Urpreis  : sPrix,
                    Twaers   : oLine.Twaers || "",
                    GrpValFix: oLine.GrpValFix || oLine.Grpvalfix || oLine.Kondigr || "—",
                    Mwskz    : oLine.Mwskz || "—",
                    Prix     : sPrixVal,
                    _raw     : oLine
                };
            });

            oVM.setProperty("/lignes",      aEnriched);
            oVM.setProperty("/lignesAll",   aEnriched);
            oVM.setProperty("/lignesCount", String(aEnriched.length));
        },

      
        onFilterLignes: function (oEvent) {
            var sQuery = oEvent.getParameter("newValue").trim().toLowerCase();
            var oVM    = this.getView().getModel("viewModel");
            var aAll   = oVM.getProperty("/lignesAll") || [];

            if (!sQuery) {
                oVM.setProperty("/lignes",      aAll);
                oVM.setProperty("/lignesCount", String(aAll.length));
                return;
            }

            var aFiltered = aAll.filter(function (oLine) {
                return (oLine.Belzart  || "").toLowerCase().indexOf(sQuery) !== -1
                    || (oLine.Programm || "").toLowerCase().indexOf(sQuery) !== -1;
            });
            oVM.setProperty("/lignes",      aFiltered);
            oVM.setProperty("/lignesCount", String(aFiltered.length));
        },

      
        _parseODataDate: function (oValue) {
            if (!oValue) { return null; }
            if (typeof oValue === "string" && oValue.indexOf("/Date(") !== -1) {
                return new Date(parseInt(oValue.replace(/\/Date\((\d+)([+-]\d+)?\)\//, "$1"), 10));
            }
            return new Date(oValue);
        },

        onTabSelect: function (oEvent) {
            console.log(">>> Onglet sélectionné :", oEvent.getParameter("key"));
        },

        onNavBack: function () {
            var oHistory      = sap.ui.core.routing.History.getInstance();
            var sPreviousHash = oHistory.getPreviousHash();
            if (sPreviousHash !== undefined) {
                window.history.go(-1);
            } else {
                sap.ui.core.UIComponent.getRouterFor(this).navTo("Routeordre_de_calcul");
            }
        },

       
        formatDocumentTitle: function (sBelnr) {
            return "Document : " + (sBelnr || "");
        },

        formatVkontBadge: function (v) {
            return "Cpte : " + (v || "");
        },

        formatVertragBadge: function (v) {
            return "+ Contrat : " + (v || "");
        },

        formatAbrvorgBadge: function (v) {
            return "Regr. : " + (v || "");
        },

        formatDate: function (oValue) {
            if (!oValue) { return ""; }
            var oDate = this._parseODataDate(oValue);
            if (!oDate || isNaN(oDate.getTime())) { return String(oValue); }
            return String(oDate.getUTCDate()).padStart(2, "0") + "/"
                 + String(oDate.getUTCMonth() + 1).padStart(2, "0") + "/"
                 + oDate.getUTCFullYear();
        }

    });
});
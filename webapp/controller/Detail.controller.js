sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("project2.controller.Detail", {

        onInit: function () {
            var oViewModel = new JSONModel({ busy: true, busyDelay: 0 });
            this.getView().setModel(oViewModel, "detailModel");

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteDetail").attachPatternMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var oArgs    = oEvent.getParameter("arguments");
            var sAnlage  = decodeURIComponent(oArgs.Anlage);
            var sAbrdats = decodeURIComponent(oArgs.Abrdats);
            this._bindView(sAnlage, sAbrdats);
        },

        _bindView: function (sAnlage, sAbrdats) {
            var oView      = this.getView();
            var oModel     = oView.getModel();
            var oViewModel = oView.getModel("detailModel");

            var sObjectPath = oModel.createKey("/ordresdeCalculSet", {
                Anlage:  sAnlage,
                Abrdats: sAbrdats
            });

            oViewModel.setProperty("/busy", true);

            oView.bindElement({
                path: sObjectPath,
                events: {
                    change: this._onBindingChange.bind(this),
                    dataRequested: function () {
                        oViewModel.setProperty("/busy", true);
                    },
                    dataReceived: function (oData) {
                        oViewModel.setProperty("/busy", false);
                        if (!oData.getParameter("data")) {
                            MessageBox.error("Ordre de calcul introuvable.", { title: "Erreur" });
                        }
                    }
                }
            });
        },

        _onBindingChange: function () {
            var oView           = this.getView();
            var oElementBinding = oView.getElementBinding();

            if (!oElementBinding.getBoundContext()) {
                MessageBox.error("Aucune donnée trouvée pour cet ordre.");
                this.onNavBack();
                return;
            }

            oView.getModel("detailModel").setProperty("/busy", false);

            var oData = oElementBinding.getBoundContext().getObject();
            if (oData && oData.Anlage) {
                this.byId("detailPage").setTitle("Ordre Facturation — " + oData.Anlage);
            }
        },

        onNavBack: function () {
            sap.ui.core.UIComponent.getRouterFor(this).navTo("Routeordre_de_calcul", {}, true);
        },

      
        onCreerDocument: function () {
            var oCtx = this.getView().getBindingContext();
            if (!oCtx) { return; }
            var oData = oCtx.getObject();
            this._confirmerCreation(oData);
        },


        _confirmerCreation: function (oData) {
            MessageBox.confirm(
                "Créer un document de facturation pour l'installation " + oData.Anlage + " ?",
                {
                    title: "Confirmation de création",
                    actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.OK,
                    onClose: function (sAction) {
                        if (sAction !== MessageBox.Action.OK) { return; }
                        this._createBillDoc(oData);
                    }.bind(this)
                }
            );
        },

        // ── Création du document de facturation ──
        _createBillDoc: function (oData) {
            var oModel     = this.getView().getModel();
            var oViewModel = this.getView().getModel("detailModel");

            var oPayload = {
                Anlage:   oData.Anlage,
                Abrdats:  oData.Abrdats,
                Bukrs:    oData.Bukrs,
                Sparte:   oData.Sparte,
                Portion:  oData.Portion,
                Trigstat: oData.Trigstat,
                Ableinh:  oData.Ableinh,
                Adatsoll: oData.Adatsoll,
                Erdat:    oData.Erdat,
                Vkonto:   oData.Vkonto
            };

            oViewModel.setProperty("/busy", true);

            oModel.create("/ordresdeCalculSet", oPayload, {

                // HTTP 200 — succès propre
                success: function (oResponseData) {
                    oViewModel.setProperty("/busy", false);
                    MessageBox.success(
                        "Document créé avec succès !\n\nInstallation : " + oData.Anlage
                        + "\nDocument : " + (oResponseData.Belnr || "—"),
                        { title: "Création réussie" }
                    );
                    this.getView().getElementBinding().refresh();
                }.bind(this),

                // HTTP 500 — analyser le message SAP
                error: function (oError) {
                    oViewModel.setProperty("/busy", false);
                    try {
                        var oResp       = JSON.parse(oError.responseText);
                        var sErrValue   = oResp.error.message.value;

                        // "terminé avec succès avec n° doc. XXXXXXXXXX"
                        // → SAP retourne E mais document bien créé
                        var oBelnrMatch = sErrValue.match(/n°\s*doc\.\s*(\d+)/i);

                        if (oBelnrMatch) {
                            // Traiter comme SUCCÈS → affichage vert
                            MessageBox.success(
                                "Document créé avec succès !\n\nInstallation : " + oData.Anlage
                                + "\nDocument : " + oBelnrMatch[1],
                                { title: "Création réussie" }
                            );
                            this.getView().getElementBinding().refresh();
                        } else {
                            // Vraie erreur métier SAP
                            MessageBox.error(sErrValue, { title: "Erreur de création" });
                        }
                    } catch (e) {
                        // JSON non parsable
                        MessageBox.error(
                            "Erreur lors de la création pour l'installation " + oData.Anlage,
                            { title: "Erreur de création" }
                        );
                    }
                }.bind(this)
            });
        },

        // ── Formatters ──
        formatDate: function (oValue) {
            if (!oValue) { return ""; }
            var oDate = typeof oValue === "string" && oValue.indexOf("/Date(") !== -1
                ? new Date(parseInt(oValue.replace(/\/Date\((\d+)([+-]\d+)?\)\//, "$1"), 10))
                : new Date(oValue);
            if (isNaN(oDate.getTime())) { return String(oValue); }
            return String(oDate.getUTCDate()).padStart(2,"0") + "/"
                 + String(oDate.getUTCMonth()+1).padStart(2,"0") + "/"
                 + oDate.getUTCFullYear();
        },
        formatStatutText: function (s) {
            return s === "2" ? "Prêt" : s === "1" ? "Erreur" : (s || "Inconnu");
        },
        formatStatutState: function (s) {
            return s === "2" ? "Success" : s === "1" ? "Error" : "None";
        },
        formatStatutIcon: function (s) {
            return s === "2" ? "sap-icon://accept" : s === "1" ? "sap-icon://error" : "sap-icon://status-unknown";
        },
        formatStatutMessage: function (s) {
            return s === "2" ? "Cet ordre est prêt. Vous pouvez générer le document de calcul."
                 : s === "1" ? "Une erreur est survenue sur cet ordre."
                 : "Statut inconnu.";
        },
        formatStatutMessageType: function (s) {
            return s === "2" ? "Success" : s === "1" ? "Error" : "None";
        },
        formatSparte: function (s) {
            var mSparte = {
                "01": "Electricité",     "02": "Gaz",
                "03": "Eau",             "06": "Gestion des déchets",
                "08": "Electricité",     "09": "Biogaz",
                "10": "Biomass",         "11": "Eolien",
                "12": "Hydraulique",     "13": "Incinération",
                "14": "Petites Instal.", "15": "Cogénération",
                "21": "Facturation d'eau"
            };
            return mSparte[s] || s || "—";
        }
    });
});
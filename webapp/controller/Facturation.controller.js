sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("project2.controller.Facturation", {

        onInit: function () {
            var oModel = new JSONModel({ documents: [] });
            this.getView().setModel(oModel, "factureModel");
            this._pendingBelnr = null;
            this._lastFilters  = [];

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteFacturation").attachMatched(this._onRouteMatched, this);
        },

        _onRouteMatched: function (oEvent) {
            var oQuery  = oEvent.getParameter("arguments")["?query"] || {};
            var sVkonto = oQuery.Vkonto || "";

            if (sVkonto) {
                this.byId("inputVkont").setValue(sVkonto);
                this.byId("inputPartner").setValue("");
                this.onSearchDocuments();
            }
        },

        onNavBack: function () {
            var oCrossAppNav = sap.ushell.Container.getService("CrossApplicationNavigation");
            oCrossAppNav.toExternal({
                target: { shellHash: "#Shell-home" }
            });
        },

        onClearOther: function (oEvent) {
            var sId = oEvent.getSource().getId();
            if (sId.includes("inputPartner")) {
                this.byId("inputVkont").setValue("");
            } else {
                this.byId("inputPartner").setValue("");
            }
        },

        _formatPartner: function (sValue) {
            if (!sValue) { return ""; }
            return sValue.trim().padStart(10, "0");
        },

        _formatVkont: function (sValue) {
            if (!sValue) { return ""; }
            return sValue.trim().padStart(12, "0");
        },

        onSearchDocuments: function () {
            var sPartner = this._formatPartner(this.byId("inputPartner").getValue());
            var sVkont   = this._formatVkont(this.byId("inputVkont").getValue());

            if (!sPartner && !sVkont) {
                MessageToast.show("Veuillez saisir un Partenaire ou un compte Contrat.");
                return;
            }

            var aFilters = [];
            if (sPartner) {
                aFilters.push(new Filter("Gpartner", FilterOperator.EQ, sPartner));
            }
            if (sVkont) {
                aFilters.push(new Filter("Vkont", FilterOperator.EQ, sVkont));
            }

            this._lastFilters = aFilters;
            this._executeSearch(aFilters);
        },

        _executeSearch: function (aFilters) {
            var oModel     = this.getView().getModel("factureModel");
            var oDataModel = this.getView().getModel();

            this._setBusy(true);

            oDataModel.read("/doctemporairepourfacturationSet", {
                filters: aFilters,
                success: function (oData) {
                    this._setBusy(false);
                    oModel.setProperty("/documents", oData.results);

                    if (oData.results.length === 0) {
                        MessageToast.show("Aucun document trouvé.");
                    }

                    if (this._pendingBelnr) {
                        this._selectRow(this._pendingBelnr);
                        this._pendingBelnr = null;
                    }
                }.bind(this),
                error: function (oError) {
                    this._setBusy(false);
                    MessageBox.error(
                        this._parseErrorMessage(oError, "Erreur lors de la recherche des documents.")
                    );
                }.bind(this)
            });
        },

        _setBusy: function (bBusy) {
            this.getView().setBusy(bBusy);
        },

        onFacturer: function () {
            var oTable         = this.byId("documentsTable");
            var aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageToast.show("Veuillez sélectionner au moins un document.");
                return;
            }

            var aDocs = aSelectedItems.map(function (oItem) {
                return oItem.getBindingContext("factureModel").getObject();
            });

            var sMsg = aDocs.length === 1
                ? "Confirmer la création de la facture pour le document " + aDocs[0].Belnr + " ?"
                : "Confirmer la création d'une seule facture globale pour les " + aDocs.length + " documents sélectionnés ?";

            MessageBox.confirm(sMsg, {
                title: "Confirmation",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._createSingleFactureForMultipleDocs(aDocs);
                    }
                }.bind(this)
            });
        },

        _createSingleFactureForMultipleDocs: function (aDocs) {
            this._setBusy(true);
            var oModel   = this.getView().getModel();
            var sPartner = aDocs[0].Gpartner;
            var sVkont   = aDocs[0].Vkont;
            var aBelnr   = aDocs.map(function (doc) { return doc.Belnr; });
            var sDocList = aBelnr.join(",");

            oModel.create("/factureSet", {
                Opbel:   aBelnr[0],
                Partner: sPartner,
                Vkont:   sVkont
            }, {
                headers: { "x-doc-list": sDocList },
                success: function (oData) {
                    this._setBusy(false);

                    var sOpbelRaw = oData.Opbel ? String(oData.Opbel).trim() : "";
                    var sOpbel    = sOpbelRaw ? sOpbelRaw.padStart(12, "0") : "";

                    console.log("=== FACTURATION SUCCESS ===");
                    console.log("Opbel brut      :", oData.Opbel);
                    console.log("Opbel formaté   :", sOpbel);

                    if (!sOpbel) {
                        MessageBox.success(
                            "Facture globale créée avec succès.\nPièce générée : inconnu", {
                            title: "Facturation réussie",
                            actions: [MessageBox.Action.CLOSE],
                            onClose: function () {
                                this._refreshAfterCreate();
                            }.bind(this)
                        });
                        return;
                    }

                    // Vérification via filtre (GET_ENTITYSET)
                    this._checkOpbelAndShowDialog(sOpbel);
                }.bind(this),
                error: function (oError) {
                    this._setBusy(false);
                    console.error("=== FACTURATION ERROR ===", oError);
                    MessageBox.error(
                        this._parseErrorMessage(oError, "Erreur lors de la facturation groupée.")
                    );
                }.bind(this)
            });
        },

        _checkOpbelAndShowDialog: function (sOpbel) {
            this._setBusy(true);
            var oModel  = this.getView().getModel();
            var aFilter = [new Filter("Opbel", FilterOperator.EQ, sOpbel)];

            console.log("=== VERIFICATION OPBEL (GET_ENTITYSET) ===");
            console.log("Filtre Opbel :", sOpbel);

            oModel.read("/verificationdesfacturesSet", {
                filters: aFilter,
                success: function (oData) {
                    this._setBusy(false);
                    console.log("Résultats :", JSON.stringify(oData));
                    var bExiste = !!(oData.results && oData.results.length > 0);
                    console.log("bExiste :", bExiste);
                    this._showSuccessDialog(sOpbel, bExiste);
                }.bind(this),
                error: function (oErr) {
                    this._setBusy(false);
                    console.warn("Erreur vérification :", oErr.statusCode, oErr.message);
                    this._showSuccessDialog(sOpbel, false);
                }.bind(this)
            });
        },

        _showSuccessDialog: function (sOpbel, bExiste) {
            console.log("=== SHOW DIALOG === bExiste:", bExiste, "| sOpbel:", sOpbel);

            var sMsg        = "Facture globale créée avec succès.\nPièce générée : " + sOpbel;
            var aActions    = bExiste
                              ? ["Valider", MessageBox.Action.CLOSE]
                              : [MessageBox.Action.CLOSE];
            var sEmphasized = bExiste ? "Valider" : MessageBox.Action.CLOSE;

            MessageBox.success(sMsg, {
                title: "Facturation réussie",
                actions: aActions,
                emphasizedAction: sEmphasized,
                onClose: function (sAction) {
                    console.log("Action choisie :", sAction);
                    if (sAction === "Valider" && bExiste) {
                        this._navigateToValidation(sOpbel);
                    }
                    this._refreshAfterCreate();
                }.bind(this)
            });
        },

        _parseErrorMessage: function (oError, sDefaultMsg) {
            var sMsg = sDefaultMsg || "Erreur inconnue";

            try {
                var sResponseText = oError.responseText || "";

                if (sResponseText.trim().startsWith("<")) {
                    var oParser  = new DOMParser();
                    var oXmlDoc  = oParser.parseFromString(sResponseText, "text/xml");
                    var oMsgNode = oXmlDoc.querySelector("message")
                                || oXmlDoc.querySelector("Message")
                                || oXmlDoc.querySelector("error > message");
                    sMsg = (oMsgNode && oMsgNode.textContent)
                           ? oMsgNode.textContent.trim()
                           : "Erreur serveur";
                } else {
                    var oResp = JSON.parse(sResponseText);
                    var oErr  = oResp.error;
                    if (oErr &&
                        oErr.innererror &&
                        oErr.innererror.errordetails &&
                        oErr.innererror.errordetails.length > 0) {
                        sMsg = oErr.innererror.errordetails[0].message;
                    } else if (oErr && oErr.message && oErr.message.value) {
                        sMsg = oErr.message.value;
                    }
                }
            } catch (e) {
                sMsg = oError.responseText || sDefaultMsg;
            }

            return sMsg;
        },

        _refreshAfterCreate: function () {
            if (this._lastFilters && this._lastFilters.length > 0) {
                this._executeSearch(this._lastFilters);
            } else {
                this.onSearchDocuments();
            }
        },

        _selectRow: function (sBelnr) {
            var oTable = this.byId("documentsTable");

            setTimeout(function () {
                oTable.removeSelections(true);
                oTable.getItems().forEach(function (oItem) {
                    var sItemBelnr = oItem.getBindingContext("factureModel").getProperty("Belnr");
                    if (sItemBelnr === sBelnr) {
                        oTable.setSelectedItem(oItem, true);
                        var oDomRef = oItem.getDomRef();
                        if (oDomRef) {
                            oDomRef.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                        oItem.focus();
                    }
                });
            }, 300);
        },

        _navigateToValidation: function (sOpbel) {
            sap.ui.core.UIComponent.getRouterFor(this).navTo("RouteValidation_document", {
                "?query": {
                    OpbelFrom: sOpbel,
                    OpbelTo  : sOpbel
                }
            });
        }

    });
});
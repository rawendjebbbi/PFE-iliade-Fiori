sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/routing/History"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox, History) {
    "use strict";

    return Controller.extend("project2.controller.OrdreReleve", {

        onInit: function () {
            var oViewModel = new JSONModel({
                busy:               false,
                tableVisible:       false,
                totalCount:         0,
                selectedObjectType: "UniteReleve",
                selectedRow:        null,
                selectedRowInfo:    "",
                ordresExistants:    [],
                listObjets: {
                    uniteReleve:  "",
                    contrat:      "",
                    installation: "",
                    appareil:     ""
                },
                autresDonnees: { mtfRel: "" }
            });
            
            this.getView().setModel(oViewModel, "viewModel");

            var oComponent = this.getOwnerComponent();
            if (oComponent) {
                var oRouter = oComponent.getRouter();
                if (oRouter) {
                    var oRoute = oRouter.getRoute("RouteOrdreReleve");
                    if (oRoute) { oRoute.attachPatternMatched(this._onRouteMatched, this); }
                }
            }
        },

        _onRouteMatched: function () {
            var oVM = this.getView().getModel("viewModel");
            if (!oVM.getProperty("/tableVisible")) {
                this.onReset();
            }
        },

        onNavBack: function () {
            var oHistory = History.getInstance();
            if (oHistory.getPreviousHash() !== undefined) {
                window.history.go(-1);
            } else {
                this.getOwnerComponent().getRouter().navTo("RouteMain", {}, true);
            }
        },

        onObjectTypeChange: function (oEvent) {
            var sId  = oEvent.getSource().getId();
            var mMap = {
                rbUniteReleve:  "UniteReleve",
                rbContrat:      "Contrat",
                rbInstallation: "Installation",
                rbAppareil:     "Appareil"
            };
            var sKey = Object.keys(mMap).find(function (k) {
                return sId.indexOf(k) !== -1;
            });
            if (sKey) {
                this.getView().getModel("viewModel").setProperty("/selectedObjectType", mMap[sKey]);
            }
        },

        onValueHelpInstallation: function () {
            if (!this._oVHDialog) {
                this._oVHDialog = sap.ui.xmlfragment("project2.fragment.InstallationVH", this);
                this.getView().addDependent(this._oVHDialog);
            }
            this._oVHDialog.open();
        },

        onVHConfirm: function (oEvent) {
            var sVal = oEvent.getParameter("selectedContexts")[0].getObject().ANLAGE;
            this.getView().getModel("viewModel").setProperty("/listObjets/installation", sVal);
            this._oVHDialog.close();
        },

        onVHCancel: function () { this._oVHDialog.close(); },

        onExecuter: function () {
            var oVM    = this.getView().getModel("viewModel");
            var sType  = oVM.getProperty("/selectedObjectType");
            var mField = {
                UniteReleve:  "/listObjets/uniteReleve",
                Contrat:      "/listObjets/contrat",
                Installation: "/listObjets/installation",
                Appareil:     "/listObjets/appareil"
            };
            var sValeur = oVM.getProperty(mField[sType]);

            if (!sValeur || sValeur.trim() === "") {
                MessageBox.warning(
                    "Veuillez saisir une valeur pour : " + sType,
                    { title: "Champ obligatoire" }
                );
                return;
            }

            var aFilters = [];
            var sMtfRel  = oVM.getProperty("/autresDonnees/mtfRel");

            switch (sType) {
                case "UniteReleve":
                    aFilters.push(new Filter("Termschl", FilterOperator.EQ, sValeur.trim()));
                    break;
               /* case "Contrat":
                    aFilters.push(new Filter("VERTRAG", FilterOperator.EQ, sValeur.trim()));
                    break;*/
                case "Installation":
                    aFilters.push(new Filter("ANLAGE", FilterOperator.EQ, sValeur.trim()));
                    break;
                /*case "Appareil":
                    aFilters.push(new Filter("EQUNR", FilterOperator.EQ, sValeur.trim()));
                    break; */
            }

            if (sMtfRel && sMtfRel.trim() !== "") {
                aFilters.push(new Filter("Ablesgr", FilterOperator.EQ, sMtfRel.trim()));
            }

            this._aCurrentFilters = aFilters;

            oVM.setProperty("/ordresExistants", []);
            oVM.setProperty("/selectedRow", null);
            oVM.setProperty("/selectedRowInfo", "");
            oVM.setProperty("/busy", true);
            oVM.setProperty("/tableVisible", true);

            setTimeout(function () {
                var oTable   = this.byId("tableReleve");
                var oBinding = oTable ? oTable.getBinding("items") : null;
                if (oBinding) {
                    oBinding.filter(aFilters, "Application");
                } else {
                    oVM.setProperty("/busy", false);
                    oVM.setProperty("/tableVisible", false);
                    MessageToast.show("Impossible d'accéder au tableau.");
                }
            }.bind(this), 100);
        },

        onDataReceived: function (oEvent) {
            var oVM      = this.getView().getModel("viewModel");
            var oData    = oEvent.getParameter("data");
            var aResults = (oData && oData.results) ? oData.results : [];

            var iCount = aResults.length;
            oVM.setProperty("/totalCount", iCount);

            if (iCount === 0) {
                oVM.setProperty("/busy", false);
                oVM.setProperty("/ordresExistants", []);
                MessageToast.show("Aucun enregistrement de planif trouvé.");
                return;
            }

            var aAnlages = [];
            aResults.forEach(function (o) {
                var sAnlage = (o.ANLAGE || "").trim();
                if (sAnlage && aAnlages.indexOf(sAnlage) === -1) {
                    aAnlages.push(sAnlage);
                }
            });

            this._chargerOrdresExistants(aAnlages);
        },

        _chargerOrdresExistants: function (aAnlages) {
            var oVM    = this.getView().getModel("viewModel");
            var oModel = this.getOwnerComponent().getModel();

            if (!aAnlages || aAnlages.length === 0) {
                oVM.setProperty("/ordresExistants", []);
                oVM.setProperty("/busy", false);
                return;
            }

            var aOrdreFilters = [];
            if (aAnlages.length === 1) {
                aOrdreFilters.push(new Filter("Anlage", FilterOperator.EQ, aAnlages[0]));
            } else {
                var aSubFilters = aAnlages.map(function (sAnlage) {
                    return new Filter("Anlage", FilterOperator.EQ, sAnlage);
                });
                aOrdreFilters.push(new Filter({ filters: aSubFilters, and: false }));
            }

            oModel.read("/ordrereleveSet", {
                filters: aOrdreFilters,
                success: function (oData) {
                    var aOrdres = oData.results || [];
                    oVM.setProperty("/ordresExistants", aOrdres);
                    oVM.setProperty("/busy", false);
                }.bind(this),
                error: function () {
                    oVM.setProperty("/ordresExistants", []);
                    oVM.setProperty("/busy", false);
                }.bind(this)
            });
        },

        _toTimestampMs: function (vVal) {
            if (!vVal && vVal !== 0) { return null; }

            if (typeof vVal === "string") {
                var sClean = vVal.trim();

                var oMatch = /\/Date\((\d+)([+-]\d+)?\)\//.exec(sClean);
                if (oMatch) { return parseInt(oMatch[1], 10); }

                if (/^\d{14}$/.test(sClean)) {
                    var s8 = sClean.substring(0, 8);
                    var d14 = new Date(Date.UTC(
                        parseInt(s8.substring(0, 4), 10),
                        parseInt(s8.substring(4, 6), 10) - 1,
                        parseInt(s8.substring(6, 8), 10)
                    ));
                    return isNaN(d14.getTime()) ? null : d14.getTime();
                }

                if (/^\d{8}$/.test(sClean)) {
                    var d8 = new Date(Date.UTC(
                        parseInt(sClean.substring(0, 4), 10),
                        parseInt(sClean.substring(4, 6), 10) - 1,
                        parseInt(sClean.substring(6, 8), 10)
                    ));
                    return isNaN(d8.getTime()) ? null : d8.getTime();
                }

                if (/^\d{4}-\d{2}-\d{2}/.test(sClean)) {
                    var dIso = new Date(sClean.substring(0, 10) + "T00:00:00Z");
                    return isNaN(dIso.getTime()) ? null : dIso.getTime();
                }

                var oParts = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(sClean);
                if (oParts) {
                    var dDmy = new Date(Date.UTC(
                        parseInt(oParts[3], 10),
                        parseInt(oParts[2], 10) - 1,
                        parseInt(oParts[1], 10)
                    ));
                    return isNaN(dDmy.getTime()) ? null : dDmy.getTime();
                }

                if (/^\d{10}$/.test(sClean)) { return parseInt(sClean, 10) * 1000; }
                if (/^\d{13}$/.test(sClean)) { return parseInt(sClean, 10); }
            }

            if (vVal instanceof Date) { return isNaN(vVal.getTime()) ? null : vVal.getTime(); }
            if (typeof vVal === "number") { return vVal; }
            return null;
        },

        formatDate: function (vVal) {
            var iMs = this._toTimestampMs(vVal);
            if (iMs === null) { return ""; }
            var oDate = new Date(iMs);
            if (isNaN(oDate.getTime())) { return ""; }
            return String(oDate.getUTCDate()).padStart(2, "0")       + "." +
                   String(oDate.getUTCMonth() + 1).padStart(2, "0") + "." +
                   oDate.getUTCFullYear();
        },

        _toAbapDats: function (vVal) {
            if (typeof vVal === "string") {
                var sClean = vVal.trim();
                if (/^\d{14}$/.test(sClean)) {
                    return sClean.substring(0, 4) + "-" + sClean.substring(4, 6) + "-" + sClean.substring(6, 8);
                }
                if (/^\d{8}$/.test(sClean)) {
                    return sClean.substring(0, 4) + "-" + sClean.substring(4, 6) + "-" + sClean.substring(6, 8);
                }
                if (/^\d{4}-\d{2}-\d{2}$/.test(sClean)) { return sClean; }
            }
            var iMs = this._toTimestampMs(vVal);
            if (iMs === null) { return ""; }
            var oDate = new Date(iMs);
            if (isNaN(oDate.getTime())) { return ""; }
            return oDate.getUTCFullYear()                              + "-" +
                   String(oDate.getUTCMonth() + 1).padStart(2, "0")  + "-" +
                   String(oDate.getUTCDate()).padStart(2, "0");
        },

        _ordreExistePour: function (sAnlage, vAdatsoll) {
            var aOrdres = this.getView().getModel("viewModel").getProperty("/ordresExistants") || [];
            if (!sAnlage) { return false; }

            var iDatePlan = this._toTimestampMs(vAdatsoll);
            if (iDatePlan === null) { return false; }

            return aOrdres.some(function (oOrdre) {
                var sOrdreAnlage = (oOrdre.Anlage || "").trim();
                var iOrdreDate   = this._toTimestampMs(oOrdre.Adatsoll);
                return sOrdreAnlage === sAnlage.trim() && iOrdreDate === iDatePlan;
            }.bind(this));
        },

        formatOrdreIcon: function (sAnlage, sAdatsoll, _aOrdres) {
            return this._ordreExistePour(sAnlage, sAdatsoll)
                ? "sap-icon://accept"
                : "sap-icon://pending";
        },

        formatOrdreIconColor: function (sAnlage, sAdatsoll, _aOrdres) {
            return this._ordreExistePour(sAnlage, sAdatsoll)
                ? "Positive"
                : "Critical";
        },

        formatOrdreTooltip: function (sAnlage, sAdatsoll, _aOrdres) {
            return this._ordreExistePour(sAnlage, sAdatsoll)
                ? "Ordre déjà créé"
                : "Aucun ordre créé";
        },

        formatOrdreLabel: function (sAnlage, sAdatsoll, _aOrdres) {
            return this._ordreExistePour(sAnlage, sAdatsoll) ? "Créé" : "En attente";
        },

        formatOrdreState: function (sAnlage, sAdatsoll, _aOrdres) {
            return this._ordreExistePour(sAnlage, sAdatsoll) ? "Success" : "Warning";
        },

        formatRowHighlight: function (sAnlage, sAdatsoll, _aOrdres) {
            return this._ordreExistePour(sAnlage, sAdatsoll) ? "Success" : "None";
        },

        onRowSelectionChange: function (oEvent) {
            var oVM       = this.getView().getModel("viewModel");
            var oListItem = oEvent.getParameter("listItem");

            if (!oListItem) {
                oVM.setProperty("/selectedRow", null);
                oVM.setProperty("/selectedRowInfo", "");
                return;
            }

            var oData = oListItem.getBindingContext().getObject();

            if (oData) {
                oVM.setProperty("/selectedRow", oData);
                oVM.setProperty("/selectedRowInfo",
                    "Installation: "  + (oData.ANLAGE    || "") +
                    " | UteRel: "     + (oData.Termschl  || "") +
                    " | EnrgPlReel: " + (this.formatDate(oData.Termtdat) || "") +
                    " | DteRelPlan: " + (this.formatDate(oData.Adatsoll) || "") +
                    " | MR: "         + (oData.Ablesgr   || "")
                );
            }
        },

        onCreerOrdre: function () {
            var oVM  = this.getView().getModel("viewModel");
            var oRow = oVM.getProperty("/selectedRow");
            if (!oRow) { MessageToast.show("Aucune ligne sélectionnée."); return; }

            var sAnlage   = oRow.ANLAGE   || "";
            var vAdatsoll = oRow.Adatsoll;

            if (this._ordreExistePour(sAnlage, vAdatsoll)) {
                MessageBox.warning(
                    "Un ordre de relevé existe déjà pour l'installation : " + sAnlage +
                    " à la date : " + (this.formatDate(vAdatsoll) || ""),
                    { title: "Ordre existant" }
                );
                return;
            }

            MessageBox.confirm(
                "Créer un ordre de relevé pour l'installation : " + sAnlage +
                " / unité : "   + (oRow.Termschl || "") +
                " / date : "    + (this.formatDate(vAdatsoll) || "") + " ?",
                {
                    title: "Confirmation",
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.OK) {
                            this._creerOrdreOData(sAnlage, vAdatsoll);
                        }
                    }.bind(this)
                }
            );
        },

        _creerOrdreOData: function (sAnlage, vAdatsollSource) {
            var oModel = this.getOwnerComponent().getModel();
            var oVM    = this.getView().getModel("viewModel");

            var sAdatsollIso = this._toAbapDats(vAdatsollSource);

            if (!sAdatsollIso) {
                MessageBox.error(
                    "La date de relevé planifiée est invalide. Impossible de créer l'ordre.",
                    { title: "Erreur" }
                );
                return;
            }

            var oPayload = {
                Anlage:   sAnlage,
                Adatsoll: sAdatsollIso
            };

            oVM.setProperty("/busy", true);

            oModel.create("/ordrereleveSet", oPayload, {
                success: function () {
                    oVM.setProperty("/busy", false);
                    MessageBox.success("Ordre de relevé créé avec succès.", {
                        title: "Succès",
                        onClose: function () {
                            var oTable   = this.byId("tableReleve");
                            var oBinding = oTable ? oTable.getBinding("items") : null;
                            var aAnlages = [];
                            if (oBinding) {
                                var aContexts = oBinding.getCurrentContexts
                                    ? oBinding.getCurrentContexts()
                                    : oBinding.getContexts(0, oBinding.getLength());
                                aContexts.forEach(function (oCtx) {
                                    if (!oCtx) { return; }
                                    var sA = (oCtx.getObject().ANLAGE || "").trim();
                                    if (sA && aAnlages.indexOf(sA) === -1) { aAnlages.push(sA); }
                                });
                            }
                            oVM.setProperty("/busy", true);
                            this._chargerOrdresExistants(aAnlages);
                            oVM.setProperty("/selectedRow", null);
                            oVM.setProperty("/selectedRowInfo", "");
                        }.bind(this)
                    });
                }.bind(this),
                error: function (oError) {
                    oVM.setProperty("/busy", false);
                    var sMsg = "Erreur lors de la création de l'ordre.";
                    try {
                        sMsg = JSON.parse(oError.responseText).error.message.value;
                    } catch (e) {
                        try {
                            var oXml = new DOMParser().parseFromString(oError.responseText, "text/xml");
                            var oEl  = oXml.querySelector("message");
                            if (oEl) { sMsg = oEl.textContent; }
                        } catch (e2) {}
                    }
                    MessageBox.error(sMsg, { title: "Erreur" });
                }.bind(this)
            });
        },

        onExport: function () {
            var oVM      = this.getView().getModel("viewModel");
            var oModel   = this.getOwnerComponent().getModel();
            var aFilters = this._aCurrentFilters || [];

            oVM.setProperty("/busy", true);

            oModel.read("/planifreleveSet", {
                filters: aFilters,
                success: function (oData) {
                    oVM.setProperty("/busy", false);
                    var aResults = oData.results || [];

                    if (aResults.length === 0) {
                        MessageToast.show("Aucune donnée à exporter.");
                        return;
                    }

                    // Formater les dates pour l'export
                    aResults = aResults.map(function (o) {
                        return Object.assign({}, o, {
                            Termtdat: this.formatDate(o.Termtdat),
                            Adatsoll: this.formatDate(o.Adatsoll)
                        });
                    }.bind(this));

                    // Chargement dynamique pour éviter "Spreadsheet is not a constructor"
                    sap.ui.require(["sap/ui/export/Spreadsheet"], function (Spreadsheet) {
                        var oSheet = new Spreadsheet({
                            workbook: {
                                columns: [
                                    { label: "Installation", property: "ANLAGE",    type: "String" },
                                    { label: "UteRel",       property: "Termschl",  type: "String" },
                                    { label: "EnrgPlReel",   property: "Termtdat",  type: "String" },
                                    { label: "DteRelPlan",   property: "Adatsoll",  type: "String" },
                                    { label: "MR",           property: "Ablesgr",   type: "String" },
                                    { label: "TRP",          property: "Ablesart",  type: "String" },
                                    { label: "EdC",          property: "Estinbill", type: "String" }
                                ]
                            },
                            dataSource: aResults,
                            fileName:   "PlanifReleve_" + this._today() + ".xlsx"
                        });

                        oSheet.build()
                            .then(function ()    { MessageToast.show("Export terminé."); })
                            .catch(function (sE) { MessageBox.error(String(sE)); })
                            .finally(function () { oSheet.destroy(); });

                    }.bind(this));
                }.bind(this),
                error: function () {
                    oVM.setProperty("/busy", false);
                    MessageBox.error("Erreur lors de la récupération des données pour l'export.");
                }
            });
        },

        onReset: function () {
            var oVM = this.getView().getModel("viewModel");
            oVM.setData({
                busy:               false,
                tableVisible:       false,
                totalCount:         0,
                selectedObjectType: "UniteReleve",
                selectedRow:        null,
                selectedRowInfo:    "",
                ordresExistants:    [],
                listObjets: {
                    uniteReleve:  "",
                    contrat:      "",
                    installation: "",
                    appareil:     ""
                },
                autresDonnees: { mtfRel: "" }
            });
            this._aCurrentFilters = [];

            var oTable = this.byId("tableReleve");
            if (oTable && oTable.getBinding("items")) {
                oTable.getBinding("items").filter([]);
            }

            MessageToast.show("Formulaire réinitialisé.");
        },

        _today: function () {
            var d = new Date();
            return d.getFullYear() +
                   String(d.getMonth() + 1).padStart(2, "0") +
                   String(d.getDate()).padStart(2, "0");
        }

    });
});
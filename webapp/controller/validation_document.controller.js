sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/routing/History",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Text",
    "sap/m/ObjectIdentifier",
    "sap/m/ObjectStatus"
], function (
    Controller, JSONModel, Filter, FilterOperator, History,
    MessageBox, MessageToast, Column, ColumnListItem, Text, ObjectIdentifier, ObjectStatus
) {
    "use strict";

    var CONFIG = {

        calcfact: {
            entitySet   : "verificationdescocumentsSet",
            keyField    : "Belnr",
            selectFields: "Belnr,Outcnso,Manoutsort,FreiAm,FreiVon,Deviation,Simulation,Outcount,CologrpInst",
            dialogTitle : "Libérer document(s) — Calcul facturation",
            tableTitle  : "Calcul facturation",

            columns: [
                { label: "Statut",               path: "FreiVon",     width: "8rem",  status: true  },
                { label: "N°doc.cal.fact.",       path: "Belnr",       width: "10rem", bold: true    },
                { label: "N° mise attente",       path: "Outcnso",     width: "8rem"                 },
                { label: "MiseAttMan/CalcFact",   path: "Manoutsort",  width: "9rem"                 },
                { label: "Ecart",                 path: "Deviation",   width: "6rem",  hAlign: "End" },
                { label: "Simulation",            path: "Simulation",  width: "7rem"                 },
                { label: "Nbre mises att.",       path: "Outcount",    width: "8rem",  hAlign: "End" },
                { label: "Grpe coloc. install.",  path: "CologrpInst", width: "10rem"                },
                { label: "Validation le",         path: "FreiAm",      width: "8rem",  date: true    },
                { label: "Auteur validat.",       path: "FreiVon",     width: "8rem"                 }
            ],

            buildPayload: function (oDoc) {
                return { Belnr: oDoc.Belnr, FreiAm: "", FreiVon: "" };
            },

            docLabel: function (oDoc) {
                return {
                    title      : oDoc.Belnr,
                    description: "N° mise attente : " + oDoc.Outcnso
                };
            },

            contextFields: ["Belnr", "Outcnso"]
        },

        facturation: {
            entitySet   : "verificationdesfacturesSet",
            keyField    : "Opbel",
            selectFields: "Opbel,Outcnso,ValidatIn,ManoutsIn,FreiAm,FreiVon,Deviation,Simulation,Outcount,OutsortIn,OutsortPr,BgrdRelease,CologrpBp",
            dialogTitle : "Libérer document(s) — Facturation",
            tableTitle  : "Facturation",

            columns: [
                { label: "Statut",                path: "FreiVon",   width: "8rem",  status: true  },
                { label: "N° document imprimé",   path: "Opbel",     width: "10rem", bold: true    },
                { label: "N° mise attente",       path: "Outcnso",   width: "8rem"                 },
                { label: "CtrlVraisCaFact",       path: "ValidatIn", width: "9rem"                 },
                { label: "MseAtManCalFact",       path: "ManoutsIn", width: "9rem"                 },
                { label: "Ecart",                 path: "Deviation", width: "6rem",  hAlign: "End" },
                { label: "Simulation",            path: "Simulation",width: "7rem"                 },
                { label: "Nbre mises att.",       path: "Outcount",  width: "8rem",  hAlign: "End" },
                { label: "Grpe coloc. BP",        path: "CologrpBp", width: "10rem"                },
                { label: "Validation le",         path: "FreiAm",    width: "8rem",  date: true    },
                { label: "Auteur validat.",       path: "FreiVon",   width: "8rem"                 }
            ],

            buildPayload: function (oDoc) {
                return { Opbel: oDoc.Opbel, FreiAm: "", FreiVon: "" };
            },

            docLabel: function (oDoc) {
                return {
                    title      : oDoc.Opbel,
                    description: "N° mise attente : " + oDoc.Outcnso
                };
            },

            contextFields: ["Opbel", "Outcnso"]
        }
    };

    return Controller.extend("project2.controller.validation_document", {

        /* ─── INIT ─────────────────────────────────────────────────── */
        onInit: function () {
            this.getView().setModel(new JSONModel({
                busy              : false,
                busyDialog        : false,
                selectedCount     : 0,
                showResults       : false,
                inclureCalcFact   : true,
                inclureFacturation: false,
                activeMode        : null,
                dialogTitle       : "",
                dialogDocs        : [],
                selectedDocs      : [],
                liberationResults : [],
                warningMsg        : "",
                showFacturerBtn   : false
            }), "viewModel");

            this._pendingVkont = "";

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteValidation_document").attachMatched(this._onRouteMatched, this);
        },

        /* ─── NAVIGATION RETOUR HOME ────────────────────────────────── */
        onNavBack: function () {
            var oCrossAppNav = sap.ushell && sap.ushell.Container
                ? sap.ushell.Container.getService("CrossApplicationNavigation")
                : null;
            if (oCrossAppNav) {
                oCrossAppNav.toExternal({ target: { shellHash: "#Shell-home" } });
            } else {
                var sPrev = History.getInstance().getPreviousHash();
                if (sPrev !== undefined) {
                    window.history.go(-1);
                } else {
                    sap.ui.core.UIComponent.getRouterFor(this).navTo("RouteMain", {}, true);
                }
            }
        },

        /* ─── ROUTE MATCHED ─────────────────────────────────────────── */
        _onRouteMatched: function (oEvent) {
            var oArgs  = oEvent.getParameter("arguments");
            var oQuery = (oArgs && oArgs["?query"]) ? oArgs["?query"] : {};

            var sBelnrFrom = oQuery.BelnrFrom || "";
            var sBelnrTo   = oQuery.BelnrTo   || "";
            var sOpbelFrom = oQuery.OpbelFrom  || "";
            var sOpbelTo   = oQuery.OpbelTo    || "";

            var oViewModel = this.getView().getModel("viewModel");
            this._clearWarning();
            this._pendingVkont = "";
            oViewModel.setProperty("/showFacturerBtn", false);

            if (sOpbelFrom || sOpbelTo) {
                this._setModeFacturation(oViewModel);
                var oFBelnrFact   = this.byId("fBelnrFact");
                var oFBelnrFactTo = this.byId("fBelnrFactTo");
                if (oFBelnrFact)   { oFBelnrFact.setValue(sOpbelFrom); }
                if (oFBelnrFactTo) { oFBelnrFactTo.setValue(sOpbelTo); }
                oViewModel.setProperty("/activeMode",    "facturation");
                oViewModel.setProperty("/selectedCount", 0);
                oViewModel.setProperty("/selectedDocs",  []);
                oViewModel.setProperty("/busy",          true);
                this._rebindTable("facturation");
                return;
            }

            if (sBelnrFrom || sBelnrTo) {
                this._setModeCalcFact(oViewModel);
                var oFBelnr   = this.byId("fBelnr");
                var oFBelnrTo = this.byId("fBelnrTo");
                if (oFBelnr)   { oFBelnr.setValue(sBelnrFrom); }
                if (oFBelnrTo) { oFBelnrTo.setValue(sBelnrTo); }
                oViewModel.setProperty("/activeMode",    "calcfact");
                oViewModel.setProperty("/selectedCount", 0);
                oViewModel.setProperty("/selectedDocs",  []);
                oViewModel.setProperty("/busy",          true);
                this._searchCalcFact();
                return;
            }

            this._setModeCalcFact(oViewModel);
        },

        /* ─── HELPERS MODE ──────────────────────────────────────────── */
        _setModeCalcFact: function (oViewModel) {
            oViewModel.setProperty("/inclureCalcFact",    true);
            oViewModel.setProperty("/inclureFacturation", false);
            var oCbCalcFact    = this.byId("cbCalcFact");
            var oCbFacturation = this.byId("cbFacturation");
            if (oCbCalcFact)    { oCbCalcFact.setSelected(true);    }
            if (oCbFacturation) { oCbFacturation.setSelected(false); }
        },

        _setModeFacturation: function (oViewModel) {
            oViewModel.setProperty("/inclureCalcFact",    false);
            oViewModel.setProperty("/inclureFacturation", true);
            var oCbCalcFact    = this.byId("cbCalcFact");
            var oCbFacturation = this.byId("cbFacturation");
            if (oCbCalcFact)    { oCbCalcFact.setSelected(false);  }
            if (oCbFacturation) { oCbFacturation.setSelected(true); }
        },

        /* ─── TOGGLE SECTIONS ───────────────────────────────────────── */
        onToggleCalcFact: function (oEvent) {
            var bSelected  = oEvent.getParameter("selected");
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/inclureCalcFact", bSelected);
            if (bSelected) {
                oViewModel.setProperty("/inclureFacturation", false);
                this.byId("cbFacturation").setSelected(false);
                this._clearWarning();
            } else {
                if (!oViewModel.getProperty("/inclureFacturation")) { this._showWarning(); }
            }
        },

        onToggleFacturation: function (oEvent) {
            var bSelected  = oEvent.getParameter("selected");
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/inclureFacturation", bSelected);
            if (bSelected) {
                oViewModel.setProperty("/inclureCalcFact", false);
                this.byId("cbCalcFact").setSelected(false);
                this._clearWarning();
            } else {
                if (!oViewModel.getProperty("/inclureCalcFact")) { this._showWarning(); }
            }
        },

        /* ─── AVERTISSEMENT ─────────────────────────────────────────── */
        _showWarning: function () {
            this.getView().getModel("viewModel").setProperty("/warningMsg",
                "Veuillez sélectionner une seule section (Calcul facturation ou Facturation).");
        },
        _clearWarning: function () {
            this.getView().getModel("viewModel").setProperty("/warningMsg", "");
        },

        /* ─── RECHERCHE ─────────────────────────────────────────────── */
        onSearch: function () {
            var oViewModel   = this.getView().getModel("viewModel");
            var bCalcFact    = oViewModel.getProperty("/inclureCalcFact");
            var bFacturation = oViewModel.getProperty("/inclureFacturation");

            if (!bCalcFact && !bFacturation) {
                MessageBox.warning(
                    "Veuillez sélectionner une seule section (Calcul facturation ou Facturation)."
                );
                return;
            }

            var sMode = bCalcFact ? "calcfact" : "facturation";
            oViewModel.setProperty("/activeMode",      sMode);
            oViewModel.setProperty("/selectedCount",   0);
            oViewModel.setProperty("/selectedDocs",    []);
            oViewModel.setProperty("/showFacturerBtn", false);
            this._pendingVkont = "";
            this._clearWarning();

            if (sMode === "calcfact") {
                this._searchCalcFact();
            } else {
                oViewModel.setProperty("/busy", true);
                this._rebindTable("facturation");
            }
        },

        /* ─── RECHERCHE CALCUL FACTURATION ─────────────────────────── */
        _searchCalcFact: function () {
            var oViewModel  = this.getView().getModel("viewModel");
            var oODataModel = this.getOwnerComponent().getModel();
            var aFiltersErch = [];

            var sVertragFrom = this.byId("fVertrag")   ? this.byId("fVertrag").getValue().trim()   : "";
            var sVertragTo   = this.byId("fVertragTo") ? this.byId("fVertragTo").getValue().trim() : "";
            if (sVertragFrom) { sVertragFrom = sVertragFrom.padStart(10, "0"); }
            if (sVertragTo)   { sVertragTo   = sVertragTo.padStart(10, "0");   }
            this._addBT(aFiltersErch, "Vertrag", sVertragFrom, sVertragTo);

            this._addBT(aFiltersErch, "BILLINGRUNNO",
                this.byId("fAbrvorg")   ? this.byId("fAbrvorg").getValue().trim()   : "",
                this.byId("fAbrvorgTo") ? this.byId("fAbrvorgTo").getValue().trim() : "");

            this._addBT(aFiltersErch, "bruks",
                this.byId("fVkont")   ? this.byId("fVkont").getValue().trim()   : "",
                this.byId("fVkontTo") ? this.byId("fVkontTo").getValue().trim() : "");

            this._addBT(aFiltersErch, "sparte",
                this.byId("fBegabrpe")   ? this.byId("fBegabrpe").getValue().trim()   : "",
                this.byId("fBegabrpeTo") ? this.byId("fBegabrpeTo").getValue().trim() : "");

            this._addBT(aFiltersErch, "Ableinh",
                this.byId("fEndabrpe")   ? this.byId("fEndabrpe").getValue().trim()   : "",
                this.byId("fEndabrpeTo") ? this.byId("fEndabrpeTo").getValue().trim() : "");

            if (aFiltersErch.length === 0) {
                oViewModel.setProperty("/busy", true);
                this._rebindTable("calcfact");
                return;
            }

            oViewModel.setProperty("/busy", true);

            oODataModel.read("/documentsdecalculSet", {
                filters      : aFiltersErch,
                urlParameters: { "$select": "Belnr", "$top": "9999" },

                success: function (oData) {
                    var aBelnrList = oData.results.map(function (o) { return o.Belnr; });
                    if (aBelnrList.length === 0) {
                        oViewModel.setProperty("/busy", false);
                        this.byId("verificationTable").unbindItems();
                        this.byId("tableTitle2").setText("Liste des Calcul facturation (0)");
                        return;
                    }
                    var aFinalFilters = this._filtersCalcFact();
                    var aFiltreIN = aBelnrList.map(function (sBelnr) {
                        return new Filter("Belnr", FilterOperator.EQ, sBelnr);
                    });
                    aFinalFilters.push(new Filter({ filters: aFiltreIN, and: false }));
                    this._rebindTableWithFilters(aFinalFilters);
                }.bind(this),

                error: function (oError) {
                    oViewModel.setProperty("/busy", false);
                    MessageBox.error(
                        "Erreur lors de la lecture des documents de calcul.\n" +
                        this._parseODataError(oError)
                    );
                }.bind(this)
            });
        },

        /* ─── REBIND TABLE ──────────────────────────────────────────── */
        _rebindTable: function (sMode) {
            var oCfg      = CONFIG[sMode];
            var oTable    = this.byId("verificationTable");
            var oTemplate = this._buildRowTemplate(oCfg.columns);
            var aFilters  = this._buildFilters(sMode);
            this._rebuildColumns(oTable, oCfg.columns);
            oTable.bindItems({
                path      : "/" + oCfg.entitySet,
                filters   : aFilters,
                parameters: { select: oCfg.selectFields, top: 9999 },
                template  : oTemplate,
                events    : {
                    dataReceived: function () {
                        this.getView().getModel("viewModel").setProperty("/busy", false);
                    }.bind(this)
                }
            });
        },

        _rebindTableWithFilters: function (aFilters) {
            var oCfg      = CONFIG["calcfact"];
            var oTable    = this.byId("verificationTable");
            var oTemplate = this._buildRowTemplate(oCfg.columns);
            this._rebuildColumns(oTable, oCfg.columns);
            oTable.bindItems({
                path      : "/" + oCfg.entitySet,
                filters   : aFilters,
                parameters: { select: oCfg.selectFields, top: 9999 },
                template  : oTemplate,
                events    : {
                    dataReceived: function () {
                        this.getView().getModel("viewModel").setProperty("/busy", false);
                    }.bind(this)
                }
            });
        },

        _rebuildColumns: function (oTable, aColDefs) {
            oTable.destroyColumns();
            aColDefs.forEach(function (oColDef) {
                oTable.addColumn(new Column({
                    width : oColDef.width || "10rem",
                    hAlign: oColDef.hAlign || "Begin",
                    header: new Text({ text: oColDef.label })
                }));
            });
        },

        _buildRowTemplate: function (aColDefs) {
            var aCells = aColDefs.map(function (oColDef) {
                if (oColDef.status) {
                    return new ObjectStatus({
                        icon: {
                            path: oColDef.path,
                            formatter: function (sVal) {
                                return (sVal && sVal.trim()) ? "sap-icon://accept" : "sap-icon://pending";
                            }
                        },
                        text: {
                            path: oColDef.path,
                            formatter: function (sVal) {
                                return (sVal && sVal.trim()) ? "Validé" : "En attente";
                            }
                        },
                        state: {
                            path: oColDef.path,
                            formatter: function (sVal) {
                                return (sVal && sVal.trim()) ? "Success" : "Warning";
                            }
                        }
                    });
                }
                if (oColDef.bold) {
                    return new ObjectIdentifier({ title: "{" + oColDef.path + "}" });
                }
                if (oColDef.date) {
                    return new Text({
                        text: { path: oColDef.path, formatter: this.formatDate.bind(this) }
                    });
                }
                return new Text({ text: "{" + oColDef.path + "}" });
            }.bind(this));
            return new ColumnListItem({ type: "Active", cells: aCells });
        },

        /* ─── FILTRES ───────────────────────────────────────────────── */
        _buildFilters: function (sMode) {
            return sMode === "calcfact"
                ? this._filtersCalcFact()
                : this._filtersFacturation();
        },

        _filtersCalcFact: function () {
            var aF = [];
            this._addBT(aF, "Belnr",
                this.byId("fBelnr")   ? this.byId("fBelnr").getValue().trim()   : "",
                this.byId("fBelnrTo") ? this.byId("fBelnrTo").getValue().trim() : "");
            this._addBT(aF, "Manoutsort",
                this.byId("fManoutsortCalc")   ? this.byId("fManoutsortCalc").getValue().trim()   : "",
                this.byId("fManoutsortCalcTo") ? this.byId("fManoutsortCalcTo").getValue().trim() : "");
            return aF;
        },

        _filtersFacturation: function () {
            var aF = [];
            var sOpbelFrom = this.byId("fBelnrFact")   ? this.byId("fBelnrFact").getValue().trim()   : "";
            var sOpbelTo   = this.byId("fBelnrFactTo") ? this.byId("fBelnrFactTo").getValue().trim() : "";
            if (sOpbelFrom) { sOpbelFrom = sOpbelFrom.padStart(12, "0"); }
            if (sOpbelTo)   { sOpbelTo   = sOpbelTo.padStart(12, "0");   }
            this._addBT(aF, "Opbel",     sOpbelFrom, sOpbelTo);
            this._addBT(aF, "ValidatIn",
                this.byId("fValidationFact")   ? this.byId("fValidationFact").getValue().trim()   : "",
                this.byId("fValidationFactTo") ? this.byId("fValidationFactTo").getValue().trim() : "");
            this._addBT(aF, "ManoutsIn",
                this.byId("fManoutsort")   ? this.byId("fManoutsort").getValue().trim()   : "",
                this.byId("fManoutsortTo") ? this.byId("fManoutsortTo").getValue().trim() : "");
            return aF;
        },

        _addBT: function (aFilters, sField, sFrom, sTo) {
            if (sFrom && sTo) {
                aFilters.push(new Filter(sField, FilterOperator.BT, sFrom, sTo));
            } else if (sFrom) {
                aFilters.push(new Filter(sField, FilterOperator.EQ, sFrom));
            } else if (sTo) {
                aFilters.push(new Filter(sField, FilterOperator.EQ, sTo));
            }
        },

        /* ─── RESET ─────────────────────────────────────────────────── */
        onResetFilters: function () {
            ["fBelnr", "fBelnrTo", "fManoutsortCalc", "fManoutsortCalcTo",
             "fVertrag", "fVertragTo", "fAbrvorg", "fAbrvorgTo",
             "fVkont", "fVkontTo", "fBegabrpe", "fBegabrpeTo",
             "fEndabrpe", "fEndabrpeTo", "fBelnrFact", "fBelnrFactTo",
             "fValidationFact", "fValidationFactTo", "fManoutsort", "fManoutsortTo"]
                .forEach(function (sId) {
                    var oCtrl = this.byId(sId);
                    if (oCtrl) { oCtrl.setValue(""); }
                }, this);

            var oTable = this.byId("verificationTable");
            oTable.unbindItems();
            oTable.destroyColumns();

            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/activeMode",      null);
            oViewModel.setProperty("/selectedCount",   0);
            oViewModel.setProperty("/selectedDocs",    []);
            oViewModel.setProperty("/showFacturerBtn", false);
            this._pendingVkont = "";
            this._clearWarning();
        },

        /* ─── ÉVÉNEMENTS TABLE ──────────────────────────────────────── */
        onUpdateFinished: function (oEvent) {
            var iTotal     = oEvent.getParameter("total");
            var oViewModel = this.getView().getModel("viewModel");
            var sMode      = oViewModel.getProperty("/activeMode");
            var sLabel     = sMode ? CONFIG[sMode].tableTitle : "documents";
            this.byId("tableTitle2").setText("Liste des " + sLabel + " (" + iTotal + ")");
            oViewModel.setProperty("/busy", false);
        },

        onSelectionChange: function () {
            var oTable     = this.byId("verificationTable");
            var aItems     = oTable.getSelectedItems();
            var oViewModel = this.getView().getModel("viewModel");
            var sMode      = oViewModel.getProperty("/activeMode");
            var oCfg       = CONFIG[sMode];

            oViewModel.setProperty("/selectedCount", aItems.length);

            var aSelectedDocs = aItems.map(function (oItem) {
                var oCtx = oItem.getBindingContext();
                var oDoc = {};
                oCfg.contextFields.forEach(function (sField) {
                    oDoc[sField] = oCtx.getProperty(sField);
                });
                return oDoc;
            });

            oViewModel.setProperty("/selectedDocs", aSelectedDocs);
        },

        onCancelSelection: function () {
            this.byId("verificationTable").removeSelections(true);
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/selectedCount", 0);
            oViewModel.setProperty("/selectedDocs",  []);
        },

        onRefresh: function () {
            var oViewModel = this.getView().getModel("viewModel");
            var sMode      = oViewModel.getProperty("/activeMode");
            this.onCancelSelection();
            if (sMode) {
                if (sMode === "calcfact") {
                    this._searchCalcFact();
                } else {
                    oViewModel.setProperty("/busy", true);
                    this._rebindTable(sMode);
                }
            }
            MessageToast.show("Données actualisées.");
        },

        /* ─── LIBÉRER DOCUMENT ──────────────────────────────────────── */
        onLibererDocument: function () {
            var oViewModel = this.getView().getModel("viewModel");

            if (oViewModel.getProperty("/selectedCount") === 0) {
                MessageBox.warning("Veuillez sélectionner au moins un document.");
                return;
            }

            var sMode     = oViewModel.getProperty("/activeMode");
            var oCfg      = CONFIG[sMode];
            var aSelected = oViewModel.getProperty("/selectedDocs");

            oViewModel.setProperty("/dialogTitle",       oCfg.dialogTitle);
            oViewModel.setProperty("/showResults",       false);
            oViewModel.setProperty("/liberationResults", []);
            oViewModel.setProperty("/showFacturerBtn",   false);
            this._pendingVkont = "";

            var aDocLabels = aSelected.map(function (oDoc) { return oCfg.docLabel(oDoc); });
            oViewModel.setProperty("/dialogDocs", aDocLabels);

            this.byId("dialogLiberer").open();
        },

        /* ─── Libération séquentielle ───────────────────────────────── */
        onConfirmerLiberation: function () {
            var oViewModel  = this.getView().getModel("viewModel");
            var aSelected   = oViewModel.getProperty("/selectedDocs");
            var sMode       = oViewModel.getProperty("/activeMode");
            var oCfg        = CONFIG[sMode];
            var oODataModel = this.getOwnerComponent().getModel();
            var oController = this;
            var aResults    = [];

            this.byId("btnConfirmerLiberation").setEnabled(false);
            oViewModel.setProperty("/busyDialog", true);

            var fnLibererOne = function (oDoc) {
                return new Promise(function (resolve) {
                    var oPayload = oCfg.buildPayload(oDoc);
                    oODataModel.create("/" + oCfg.entitySet, oPayload, {
                        success: function (oData) {
                            resolve({
                                keyValue: oPayload[oCfg.keyField],
                                success : true,
                                FreiAm  : oData.FreiAm  || "",
                                FreiVon : oData.FreiVon || ""
                            });
                        },
                        error: function (oError) {
                            resolve({
                                keyValue: oPayload[oCfg.keyField],
                                success : false,
                                message : oController._parseODataError(oError)
                            });
                        }
                    });
                });
            };

            var oChain = aSelected.reduce(function (oPromise, oDoc) {
                return oPromise.then(function () {
                    return fnLibererOne(oDoc).then(function (oResult) {
                        aResults.push(oResult);
                    });
                });
            }, Promise.resolve());

            oChain.then(function () {
                oViewModel.setProperty("/liberationResults", aResults);
                oViewModel.setProperty("/showResults",       true);
                oViewModel.setProperty("/busyDialog",        false);

                // Rafraîchir la table
                if (sMode === "calcfact") {
                    oController._searchCalcFact();
                } else {
                    oController._rebindTable(sMode);
                }
                oController.onCancelSelection();

                var iOk  = aResults.filter(function (r) { return  r.success; }).length;
                var iErr = aResults.filter(function (r) { return !r.success; }).length;

                if (iErr > 0) {
                    // Résultat partiel → MessageBox warning
                    MessageBox.warning(
                        iOk + " libéré(s) avec succès, " + iErr + " en erreur.",
                        { title: "Résultat partiel" }
                    );
                } else if (iOk > 0 && sMode === "calcfact") {
                    // Tout succès en mode calcfact → afficher bouton Facturer dans le dialog
                    var aBelnrs = aSelected.map(function (o) { return o.Belnr; });
                    oController._fetchVkontForDialog(aBelnrs);
                }
                // Succès mode facturation → résultats visibles dans le dialog, rien d'autre
            });
        },

        /* ─── Récupère Vkont et active le bouton Facturer dans le dialog ── */
        _fetchVkontForDialog: function (aBelnrs) {
            var oController = this;
            var oODataModel = this.getOwnerComponent().getModel();
            var oViewModel  = this.getView().getModel("viewModel");

            oODataModel.read("/documentsdecalculSet", {
                filters      : [new Filter("Belnr", FilterOperator.EQ, aBelnrs[0])],
                urlParameters: { "$select": "Belnr,Vkont", "$top": "1" },

                success: function (oData) {
                    var sVkont = (oData.results && oData.results.length > 0 && oData.results[0].Vkont)
                        ? oData.results[0].Vkont.trim()
                        : "";
                    oController._pendingVkont = sVkont;
                    // Afficher le bouton Facturer dans le dialog uniquement si Vkont trouvé
                    oViewModel.setProperty("/showFacturerBtn", !!sVkont);
                },

                error: function () {
                    oController._pendingVkont = "";
                    oViewModel.setProperty("/showFacturerBtn", false);
                }
            });
        },

        /* ─── Clic sur bouton "Facturer" dans le dialog ─────────────── */
        onFacturerDepuisDialog: function () {
            var sVkont = this._pendingVkont || "";

            // Fermer et réinitialiser le dialog
            this.byId("dialogLiberer").close();
            this.byId("btnConfirmerLiberation").setEnabled(true);

            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/showResults",       false);
            oViewModel.setProperty("/liberationResults", []);
            oViewModel.setProperty("/showFacturerBtn",   false);
            this._pendingVkont = "";

            if (sVkont) {
                this._navigateToFacturation(sVkont);
            }
        },

        /* ─── Navigation vers Facturation ──────────────────────────── */
        _navigateToFacturation: function (sVkont) {
            sap.ui.core.UIComponent.getRouterFor(this).navTo("RouteFacturation", {
                "?query": { Vkonto: sVkont }
            });
        },

        /* ─── Fermer le dialog ──────────────────────────────────────── */
        onFermerDialog: function () {
            this.byId("dialogLiberer").close();
            this.byId("btnConfirmerLiberation").setEnabled(true);
            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/showResults",       false);
            oViewModel.setProperty("/liberationResults", []);
            oViewModel.setProperty("/showFacturerBtn",   false);
            this._pendingVkont = "";
        },

        /* ─── HELPERS ───────────────────────────────────────────────── */
        _parseODataError: function (oError) {
            var sDefault = "Erreur inconnue";
            if (!oError || !oError.responseText) { return sDefault; }
            try {
                var oJson = JSON.parse(oError.responseText);
                return (oJson.error && oJson.error.message && oJson.error.message.value)
                    ? oJson.error.message.value : sDefault;
            } catch (eJson) { /* pas du JSON */ }
            try {
                var oXml  = new DOMParser().parseFromString(oError.responseText, "text/xml");
                var oNode = oXml.querySelector("message") || oXml.querySelector("Message");
                if (oNode && oNode.textContent) { return oNode.textContent; }
            } catch (eXml) { /* rien */ }
            return sDefault;
        },

        /* ─── FORMATTERS ────────────────────────────────────────────── */
        formatDate: function (sValue) {
            if (!sValue) { return ""; }
            if (typeof sValue === "string" && sValue.indexOf("0000") === 0) { return ""; }
            var oDate;
            if (sValue instanceof Date) {
                oDate = sValue;
            } else if (typeof sValue === "string" && sValue.indexOf("/Date(") > -1) {
                oDate = new Date(parseInt(sValue.replace("/Date(", "").replace(")/", ""), 10));
            } else {
                oDate = new Date(sValue);
            }
            if (isNaN(oDate.getTime())) { return String(sValue); }
            return oDate.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" });
        },

        formatModeText: function (sMode) {
            if (!sMode) { return ""; }
            return sMode === "calcfact" ? "Calcul facturation" : "Facturation";
        }
    });
});
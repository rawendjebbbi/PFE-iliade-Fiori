sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/m/MessageToast",
    "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("project2.controller.ordre_de_calcul", {

       
        onInit: function () {
            this.getView().setModel(new JSONModel({
                busy:          false,
                totalCount:    0,
                selectedCount: 0
            }), "viewModel");

            this.oFilterBar     = this.byId("filterbar");
            this.oTable         = this.byId("ordreCalculTable");

            this.oFilterBar.registerFetchData(this.fetchData.bind(this));
            this.oFilterBar.registerApplyData(this.applyData.bind(this));
            this.oFilterBar.registerGetFiltersWithValues(this.getFiltersWithValues.bind(this));

            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("Routeordre_de_calcul").attachMatched(this._onRouteMatched, this);
        },

        onNavBack: function () {
            var oCrossAppNav = sap.ushell && sap.ushell.Container
                ? sap.ushell.Container.getService("CrossApplicationNavigation")
                : null;
            if (oCrossAppNav) {
                oCrossAppNav.toExternal({ target: { shellHash: "#Shell-home" } });
            } else {
                var oHistory = sap.ui.core.routing.History.getInstance();
                var sPrev    = oHistory.getPreviousHash();
                if (sPrev !== undefined) {
                    window.history.go(-1);
                } else {
                    sap.ui.core.UIComponent.getRouterFor(this).navTo("RouteMain", {}, true);
                }
            }
        },

        _onRouteMatched: function () {
            var oModel = this.getView().getModel();
            if (oModel) { oModel.setUseBatch(false); }

            var oBinding = this.oTable && this.oTable.getBinding("items");
            if (oBinding) {
                this.getView().getModel("viewModel").setProperty("/busy", true);
                oBinding.filter([], "Application");
                oBinding.refresh();
            }
            this._updateLabels();
        },

      
        onExit: function () {
            this.oFilterBar = this.oTable = null;
        },

      
        fetchData: function () {
            return [
                { groupName: "G1", fieldName: "Anlage",   fieldData: this.byId("fAnlage").getValue() },
                { groupName: "G1", fieldName: "Vkonto",   fieldData: this.byId("fVkonto").getValue() },
                { groupName: "G1", fieldName: "Bukrs",    fieldData: this.byId("fBukrs").getValue() },
                { groupName: "G1", fieldName: "Trigstat", fieldData: this.byId("fTrigstat").getSelectedKey() },
                { groupName: "G1", fieldName: "Portion",  fieldData: this.byId("fPortion").getValue() },
                { groupName: "G1", fieldName: "Ableinh",  fieldData: this.byId("fAbleinh").getValue() },
                { groupName: "G1", fieldName: "Adatsoll", fieldData: {
                    from: this.byId("fDateRange").getDateValue(),
                    to:   this.byId("fDateRange").getSecondDateValue()
                }}
            ];
        },

       
        applyData: function (aData) {
            aData.forEach(function (o) {
                switch (o.fieldName) {
                    case "Anlage":   this.byId("fAnlage").setValue(o.fieldData || "");         break;
                    case "Vkonto":   this.byId("fVkonto").setValue(o.fieldData || "");         break;
                    case "Bukrs":    this.byId("fBukrs").setValue(o.fieldData || "");          break;
                    case "Trigstat": this.byId("fTrigstat").setSelectedKey(o.fieldData || ""); break;
                    case "Portion":  this.byId("fPortion").setValue(o.fieldData || "");        break;
                    case "Ableinh":  this.byId("fAbleinh").setValue(o.fieldData || "");        break;
                    case "Adatsoll":
                        if (o.fieldData && o.fieldData.from) {
                            this.byId("fDateRange").setDateValue(new Date(o.fieldData.from));
                        }
                        if (o.fieldData && o.fieldData.to) {
                            this.byId("fDateRange").setSecondDateValue(new Date(o.fieldData.to));
                        }
                        break;
                }
            }, this);
        },

        getFiltersWithValues: function () {
            var aItems = [];
            if (this.byId("fAnlage").getValue().trim())   { aItems.push(this.oFilterBar.determineFilterItemByName("Anlage",   "G1")); }
            if (this.byId("fVkonto").getValue().trim())   { aItems.push(this.oFilterBar.determineFilterItemByName("Vkonto",   "G1")); }
            if (this.byId("fBukrs").getValue().trim())    { aItems.push(this.oFilterBar.determineFilterItemByName("Bukrs",    "G1")); }
            if (this.byId("fTrigstat").getSelectedKey())  { aItems.push(this.oFilterBar.determineFilterItemByName("Trigstat", "G1")); }
            if (this.byId("fPortion").getValue().trim())  { aItems.push(this.oFilterBar.determineFilterItemByName("Portion",  "G1")); }
            if (this.byId("fAbleinh").getValue().trim())  { aItems.push(this.oFilterBar.determineFilterItemByName("Ableinh",  "G1")); }
            if (this.byId("fDateRange").getDateValue())   { aItems.push(this.oFilterBar.determineFilterItemByName("Adatsoll", "G1")); }
            return aItems.filter(Boolean);
        },

       
        onSearch: function () {
            this._applyClientFilters();
            this._updateLabels();
        },

        
        onFilterChange: function () {
            this._updateLabels();
            this.oTable.setShowOverlay(true);
        },

     
        _buildClientFilters: function () {
            var aFilters  = [];
            var sAnlage   = this.byId("fAnlage").getValue().trim();
            var sVkonto   = this.byId("fVkonto").getValue().trim();
            var sBukrs    = this.byId("fBukrs").getValue().trim();
            var sTrigstat = this.byId("fTrigstat").getSelectedKey();
            var sPortion  = this.byId("fPortion").getValue().trim();
            var sAbleinh  = this.byId("fAbleinh").getValue().trim();
            var oRange    = this.byId("fDateRange");
            var oFrom     = oRange.getDateValue();
            var oTo       = oRange.getSecondDateValue();

            if (sAnlage)   { aFilters.push(new Filter("Anlage",   FilterOperator.Contains, sAnlage)); }
            if (sVkonto)   { aFilters.push(new Filter("Vkonto",   FilterOperator.Contains, sVkonto)); }
            if (sBukrs)    { aFilters.push(new Filter("Bukrs",    FilterOperator.Contains, sBukrs)); }
            if (sTrigstat) { aFilters.push(new Filter("Trigstat", FilterOperator.EQ,       sTrigstat)); }
            if (sPortion)  { aFilters.push(new Filter("Portion",  FilterOperator.Contains, sPortion)); }
            if (sAbleinh)  { aFilters.push(new Filter("Ableinh",  FilterOperator.Contains, sAbleinh)); }

            if (oFrom && oTo) {
                var oToEnd = new Date(oTo);
                oToEnd.setHours(23, 59, 59, 999);
                aFilters.push(new Filter("Adatsoll", FilterOperator.BT, oFrom, oToEnd));
            } else if (oFrom) {
                aFilters.push(new Filter("Adatsoll", FilterOperator.GE, oFrom));
            } else if (oTo) {
                var oToEnd2 = new Date(oTo);
                oToEnd2.setHours(23, 59, 59, 999);
                aFilters.push(new Filter("Adatsoll", FilterOperator.LE, oToEnd2));
            }

            return aFilters;
        },

        // ── Application des filtres sur la table ──
        _applyClientFilters: function () {
            var oBinding = this.oTable.getBinding("items");
            if (!oBinding) { return; }
            var aFilters = this._buildClientFilters();
            oBinding.filter(
                aFilters.length === 0 ? [] : [new Filter({ filters: aFilters, and: true })],
                "Application"
            );
            this.oTable.setShowOverlay(false);
        },

        // ── Mise à jour des labels filtres actifs ──
        _updateLabels: function () {
            var n = this.getFiltersWithValues().length;
            var s = n === 0 ? "Aucun filtre actif"
                  : n === 1 ? "1 filtre actif"
                  : n + " filtres actifs";
           
            var oExp = this.byId("expandedLabel");
            var oSnp = this.byId("snappedLabel");
            if (oExp) { oExp.setText(s); }
            if (oSnp) { oSnp.setText(s); }
        },

    
        onSelectionChange: function () {
            this.getView().getModel("viewModel")
                .setProperty("/selectedCount", this.oTable.getSelectedItems().length);
        },

        
        onCancelSelection: function () {
            this.oTable.removeSelections(true);
            this.getView().getModel("viewModel").setProperty("/selectedCount", 0);
        },

      
        onTraiter: function () {
            var aItems = this.oTable.getSelectedItems();
            if (!aItems.length) {
                MessageToast.show("Aucun élément sélectionné.");
                return;
            }

            var aData = aItems.map(function (oItem) {
                return oItem.getBindingContext().getObject();
            });

            var aNonPret = aData.filter(function (o) { return o.Trigstat !== "2"; });
            if (aNonPret.length > 0) {
                MessageBox.warning(
                    "Les installations suivantes ne sont pas au statut 'Prêt' :\n"
                    + aNonPret.map(function (o) { return o.Anlage; }).join(", ")
                    + "\n\nVoulez-vous continuer quand même ?",
                    {
                        title: "Attention",
                        actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                        onClose: function (sAction) {
                            if (sAction === MessageBox.Action.YES) {
                                this._confirmerCreation(aData);
                            }
                        }.bind(this)
                    }
                );
                return;
            }
            this._confirmerCreation(aData);
        },

        
        _confirmerCreation: function (aData) {
            MessageBox.confirm(
                "Créer un document de facturation pour "
                + aData.length + " installation(s) ?\n("
                + aData.map(function (o) { return o.Anlage; }).join(", ") + ")",
                {
                    title: "Confirmation de création",
                    onClose: function (sAction) {
                        if (sAction !== MessageBox.Action.OK) { return; }
                        this._createBillDocs(aData);
                    }.bind(this)
                }
            );
        },

        
        _createBillDocs: function (aData) {
            var oModel      = this.getView().getModel();
            var oController = this;
            var aErrors     = [];
            var aSuccess    = [];

            this.getView().getModel("viewModel").setProperty("/busy", true);

            var fnCreateOne = function (oOrdre) {
                return new Promise(function (resolve) {

                    var oPayload = {
                        Anlage:   oOrdre.Anlage,
                        Abrdats:  oOrdre.Abrdats,
                        Bukrs:    oOrdre.Bukrs,
                        Sparte:   oOrdre.Sparte,
                        Portion:  oOrdre.Portion,
                        Trigstat: oOrdre.Trigstat,
                        Ableinh:  oOrdre.Ableinh,
                        Adatsoll: oOrdre.Adatsoll,
                        Erdat:    oOrdre.Erdat,
                        Vkonto:   oOrdre.Vkonto
                    };

                    oModel.create("/ordresdeCalculSet", oPayload, {

                        success: function (oResponseData) {
                            var sBelnr = oResponseData && oResponseData.Belnr
                                ? String(oResponseData.Belnr).trim()
                                : "";

                            if (sBelnr) {
                                aSuccess.push({
                                    anlage:  oOrdre.Anlage,
                                    vkonto:  oOrdre.Vkonto,
                                    abrdats: oOrdre.Abrdats,
                                    belnr:   sBelnr
                                });
                            } else {
                                aErrors.push("Installation " + oOrdre.Anlage + " : document créé mais numéro non retourné.");
                            }
                            resolve();
                        },

                        error: function (oError) {
                            var sMsg = "Installation " + oOrdre.Anlage;
                            try {
                                var oResp       = JSON.parse(oError.responseText);
                                var sErrValue   = oResp.error.message.value;
                                var oBelnrMatch = sErrValue.match(/n°\s*doc\.\s*(\d+)/i);

                                if (oBelnrMatch) {
                                    aSuccess.push({
                                        anlage:  oOrdre.Anlage,
                                        vkonto:  oOrdre.Vkonto,
                                        abrdats: oOrdre.Abrdats,
                                        belnr:   oBelnrMatch[1]
                                    });
                                } else {
                                    aErrors.push(sMsg + " : " + sErrValue);
                                }
                            } catch (e) {
                                aErrors.push(sMsg);
                            }
                            resolve();
                        }
                    });
                });
            };

            var oChain = aData.reduce(function (oPromise, oOrdre) {
                return oPromise.then(function () {
                    return fnCreateOne(oOrdre);
                });
            }, Promise.resolve());

            oChain.then(function () {

                oController.getView().getModel("viewModel").setProperty("/busy", false);
                oController.oTable.removeSelections(true);
                oController.getView().getModel("viewModel").setProperty("/selectedCount", 0);

                
                var oBinding = oController.oTable.getBinding("items");
                if (oBinding) { oBinding.refresh(); }

                if (aErrors.length > 0 && aSuccess.length === 0) {
                    
                    MessageBox.error(
                        "Échec de la création pour :\n\n" + aErrors.join("\n"),
                        { title: "Erreur de création" }
                    );
                    return;
                }

               
                oController._checkBelnrInVerification(aSuccess, function (bNeedsValidation) {
                    oController._showCreationResult(aSuccess, aErrors, bNeedsValidation);
                });
            });
        },

        
        _checkBelnrInVerification: function (aSuccess, fnCallback) {
            if (!aSuccess || aSuccess.length === 0) {
                fnCallback(false);
                return;
            }

            var oModel = this.getView().getModel();

           
            var sBelnr = aSuccess[0].belnr;

            oModel.read("/verificationdescocumentsSet", {
                filters: [new Filter("Belnr", FilterOperator.EQ, sBelnr)],
                urlParameters: { "$top": "1", "$select": "Belnr" },
                success: function (oData) {
                    var bExists = oData && oData.results && oData.results.length > 0;
                    fnCallback(bExists);
                },
                error: function () {
                   
                    fnCallback(false);
                }
            });
        },

       
        _showCreationResult: function (aSuccess, aErrors, bNeedsValidation) {
            var oController = this;

            var sActionBtn    = bNeedsValidation ? "Valider" : "Facturer";
            var fnNavAction   = bNeedsValidation
                ? function () { oController._navigateToValidation(aSuccess); }
                : function () { oController._navigateToFacturation(aSuccess); };

            var fnNavToDocument = function (sBelnr) {
                if (!sBelnr || sBelnr === "—") {
                    MessageToast.show("Numéro de document manquant.");
                    return;
                }
                sap.ui.core.UIComponent.getRouterFor(oController).navTo("RouteDetail_document", {
                    Belnr: sBelnr
                });
            };

            var fnOnClose = function (sAction) {
                if (sAction === sActionBtn) {
                    fnNavAction();
                } else if (sAction === "Afficher") {
                    if (aSuccess.length === 1) {
                        fnNavToDocument(aSuccess[0].belnr);
                    } else {
                        oController._showDocumentListDialog(aSuccess);
                    }
                }
            };

            if (aErrors.length === 0) {
               
                MessageBox.success(
                    aSuccess.length + " document(s) créé(s) avec succès :\n\n"
                    + aSuccess.map(function (o) {
                        return " Installation " + o.anlage + " → Document : " + o.belnr;
                    }).join("\n"),
                    {
                        title:            "Création réussie",
                        actions:          [sActionBtn, "Afficher", MessageBox.Action.CLOSE],
                        emphasizedAction: sActionBtn,
                        onClose:          fnOnClose
                    }
                );
            } else {
               
                MessageBox.warning(
                    "Résultat partiel :\n\n"
                    + "✔ Succès :\n" + aSuccess.map(function (o) {
                        return "  Installation " + o.anlage + " → Document : " + o.belnr;
                    }).join("\n")
                    + "\n\n✘ Échecs :\n" + aErrors.join("\n"),
                    {
                        title:            "Création partielle",
                        icon:             MessageBox.Icon.WARNING,
                        actions:          [sActionBtn, "Afficher", MessageBox.Action.OK],
                        emphasizedAction: sActionBtn,
                        onClose:          fnOnClose
                    }
                );
            }
        },

        _navigateToValidation: function (aSuccess) {
            var aBelnrs = aSuccess
                .map(function (o) { return o.belnr; })
                .sort(function (a, b) { return parseInt(a, 10) - parseInt(b, 10); });

            sap.ui.core.UIComponent.getRouterFor(this).navTo("RouteValidation_document", {
                "?query": {
                    BelnrFrom: aBelnrs[0],
                    BelnrTo:   aBelnrs[aBelnrs.length - 1]
                }
            });
        },

      
        _navigateToFacturation: function (aSuccess) {
            var sVkonto = aSuccess && aSuccess.length > 0 ? (aSuccess[0].vkonto || "") : "";
            sap.ui.core.UIComponent.getRouterFor(this).navTo("RouteFacturation", {
                "?query": {
                    Vkonto: sVkonto
                }
            });
        },

        _showDocumentListDialog: function (aSuccess) {
            var oController = this;

            var fnNavAndClose = function (sBelnr, oDialog) {
                if (!sBelnr || sBelnr === "—") {
                    MessageToast.show("Numéro de document manquant.");
                    return;
                }
                sap.ui.core.UIComponent.getRouterFor(oController).navTo("RouteDetail_document", {
                    Belnr: sBelnr
                });
                oDialog.close();
            };

            var aItems = aSuccess.map(function (o) {
                return new sap.m.ColumnListItem({
                    type:  "Active",
                    press: function () {
                        fnNavAndClose(o.belnr, oDialog);
                    },
                    cells: [
                        new sap.m.ObjectIdentifier({
                            title: o.anlage,
                            text:  "Compte : " + (o.vkonto || "—")
                        }),
                        new sap.m.ObjectStatus({
                            text:  "Doc. " + o.belnr,
                            state: "Success",
                            icon:  "sap-icon://accept"
                        }),
                        new sap.m.Button({
                            icon:    "sap-icon://open-folder",
                            tooltip: "Ouvrir le document",
                            type:    "Transparent",
                            press:   function (oEvent) {
                                oEvent.stopPropagation();
                                fnNavAndClose(o.belnr, oDialog);
                            }
                        })
                    ]
                });
            });

            var oTable = new sap.m.Table({
                backgroundDesign: "Transparent",
                columns: [
                    new sap.m.Column({ header: new sap.m.Label({ text: "Installation / Compte" }) }),
                    new sap.m.Column({ header: new sap.m.Label({ text: "N° Document" }) }),
                    new sap.m.Column({ header: new sap.m.Label({ text: "" }), hAlign: "End", width: "4rem" })
                ],
                items: aItems
            });

            var oDialog = new sap.m.Dialog({
                title:          "Documents créés — Choisir à afficher",
                titleAlignment: "Center",
                icon:           "sap-icon://document-text",
                contentWidth:   "520px",
                draggable:      true,
                resizable:      true,
                content: [
                    new sap.m.VBox({
                        renderType: "Bare",
                        items: [
                            new sap.m.MessageStrip({
                                text:     "Cliquez sur une ligne pour afficher le document.",
                                type:     "Information",
                                showIcon: true,
                                class:    "sapUiSmallMarginBottom"
                            }),
                            oTable
                        ]
                    })
                ],
                endButton: new sap.m.Button({
                    text:  "Fermer",
                    press: function () { oDialog.close(); }
                }),
                afterClose: function () { oDialog.destroy(); }
            });

            this.getView().addDependent(oDialog);
            oDialog.open();
        },

       
        onAfficherDocument: function () {
            var oController = this;

            var oInput = new sap.m.Input({
                id:          "inputBelnrSearch",
                placeholder: "",
                width:       "100%",
                liveChange: function () {
                    oInput.setValueState("None");
                    oInput.setValueStateText("");
                },
                submit: function () {
                    var sBelnr = oInput.getValue().trim();
                    if (!sBelnr) {
                        oInput.setValueState("Error");
                        oInput.setValueStateText("Veuillez saisir un numéro de document.");
                        return;
                    }
                    oDialog.close();
                    sap.ui.core.UIComponent.getRouterFor(oController).navTo(
                        "RouteDetail_document",
                        { Belnr: sBelnr }
                    );
                }
            });

            var oDialog = new sap.m.Dialog({
                title:          "Affichage de document",
                titleAlignment: "Center",
                icon:           "sap-icon://document-text",
                contentWidth:   "360px",
                draggable:      true,
                content: [
                    new sap.m.VBox({
                        renderType: "Bare",
                        class:      "sapUiSmallMargin",
                        items: [
                            new sap.m.Label({
                                text:   "N° doc. cal. fact.",
                                design: "Bold"
                            }),
                            new sap.m.VBox({ height: "0.4rem" }),
                            oInput
                        ]
                    })
                ],
                beginButton: new sap.m.Button({
                    text:  "OK",
                    type:  "Emphasized",
                    press: function () {
                        var sBelnr = oInput.getValue().trim();
                        if (!sBelnr) {
                            oInput.setValueState("Error");
                            oInput.setValueStateText("Veuillez saisir un numéro de document.");
                            return;
                        }
                        oDialog.close();
                        sap.ui.core.UIComponent.getRouterFor(oController).navTo(
                            "RouteDetail_document",
                            { Belnr: sBelnr }
                        );
                    }
                }),
                endButton: new sap.m.Button({
                    text:  "Annuler",
                    press: function () { oDialog.close(); }
                }),
                afterClose: function () { oDialog.destroy(); }
            });

            this.getView().addDependent(oDialog);
            oDialog.open();

            oDialog.attachAfterOpen(function () {
                oInput.focus();
            });
        },

        
        onRowPress: function (oEvent) {
            var oItem = oEvent.getParameter("listItem") || oEvent.getSource();
            var oCtx  = oItem.getBindingContext ? oItem.getBindingContext() : null;
            if (!oCtx) { return; }
            var oData = oCtx.getObject();
            sap.ui.core.UIComponent.getRouterFor(this).navTo("RouteDetail", {
                Anlage:  encodeURIComponent(oData.Anlage),
                Abrdats: encodeURIComponent(oData.Abrdats)
            });
        },

        
        onRefresh: function () {
            this.getView().getModel("viewModel").setProperty("/busy", true);
            this.byId("fAnlage").setValue("");
            this.byId("fVkonto").setValue("");
            this.byId("fBukrs").setValue("");
            this.byId("fTrigstat").setSelectedKey("");
            this.byId("fPortion").setValue("");
            this.byId("fAbleinh").setValue("");
            this.byId("fDateRange").setValue("");
            this.oTable.removeSelections(true);
            this.getView().getModel("viewModel").setProperty("/selectedCount", 0);
            var oBinding = this.oTable.getBinding("items");
            if (oBinding) { oBinding.filter([], "Application"); oBinding.refresh(); }
            this._updateLabels();
            MessageToast.show("Données actualisées");
        },

        onExportExcel: function () {
            sap.ui.require(["sap/ui/export/Spreadsheet", "sap/ui/export/library"],
            function (Spreadsheet, exportLibrary) {
                var EdmType        = exportLibrary.EdmType;
                var aSelectedItems = this.oTable.getSelectedItems();
                var aData, sFileName;

                var oColumns = [
                    { label: "Installation",      property: "Anlage",   type: EdmType.String   },
                    { label: "Compte Contrat",    property: "Vkonto",   type: EdmType.String   },
                    { label: "Société",           property: "Bukrs",    type: EdmType.String   },
                    { label: "Sect. Activité",    property: "Sparte",   type: EdmType.String   },
                    { label: "Portion",           property: "Portion",  type: EdmType.String   },
                    { label: "Date Création",     property: "Erdat",    type: EdmType.DateTime },
                    { label: "Date Relève Plan.", property: "Adatsoll", type: EdmType.DateTime },
                    { label: "DteCalcFactPlan",   property: "Abrdats",  type: EdmType.DateTime },
                    { label: "Unité Relevé",      property: "Ableinh",  type: EdmType.String   },
                    { label: "Statut",            property: "Trigstat", type: EdmType.String   }
                ];

                if (aSelectedItems.length > 0) {
                    aData     = aSelectedItems.map(function (o) { return o.getBindingContext().getObject(); });
                    sFileName = "OrdresCalcul_Selection_" + this._getTodayString() + ".xlsx";
                    MessageToast.show("Export de " + aData.length + " ligne(s) sélectionnée(s)...");
                } else {
                    var oBinding  = this.oTable.getBinding("items");
                    var aContexts = oBinding ? oBinding.getContexts(0, oBinding.getLength()) : [];
                    aData     = aContexts.map(function (c) { return c.getObject(); });
                    sFileName = "OrdresCalcul_Filtres_" + this._getTodayString() + ".xlsx";
                    MessageToast.show("Export de " + aData.length + " ligne(s) filtrée(s)...");
                }

                if (!aData || aData.length === 0) { MessageToast.show("Aucune donnée à exporter."); return; }

                new Spreadsheet({
                    workbook: { columns: oColumns, context: { application: "Gestion des ordres de calcul", version: "1.0.0" } },
                    dataSource: aData, fileName: sFileName, worker: false
                }).build()
                  .then(function () { MessageToast.show("Export Excel réussi !"); })
                  .catch(function (e) { MessageBox.error("Erreur export : " + e); });
            }.bind(this));
        },

        onDataReceived: function (oEvent) {
            if (oEvent.getParameter("error")) { MessageToast.show("Erreur lors du chargement des données."); }
        },

    
        onUpdateFinished: function (oEvent) {
            this.byId("tableTitle").setText("Ordres Facturation (" + (oEvent.getParameter("total") || 0) + ")");
            this.getView().getModel("viewModel").setProperty("/busy", false);
        },


        formatDate: function (oValue) {
            if (!oValue) { return ""; }
            var oDate = typeof oValue === "string" && oValue.indexOf("/Date(") !== -1
                ? new Date(parseInt(oValue.replace(/\/Date\((\d+)([+-]\d+)?\)\//, "$1"), 10))
                : new Date(oValue);
            if (isNaN(oDate.getTime())) { return String(oValue); }
            return String(oDate.getUTCDate()).padStart(2, "0") + "/"
                 + String(oDate.getUTCMonth() + 1).padStart(2, "0") + "/"
                 + oDate.getUTCFullYear();
        },

        formatStatutText:  function (s) { return s === "2" ? "Prêt" : s === "1" ? "Erreur" : (s || ""); },
        formatStatutState: function (s) { return s === "2" ? "Success" : s === "1" ? "Error" : "None"; },
        formatStatutIcon:  function (s) { return s === "2" ? "sap-icon://accept" : s === "1" ? "sap-icon://error" : ""; },

        _getTodayString: function () {
            var d = new Date();
            return String(d.getDate()).padStart(2, "0") + String(d.getMonth() + 1).padStart(2, "0") + d.getFullYear();
        }
    });
});
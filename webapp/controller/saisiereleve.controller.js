sap.ui.define([
  "sap/ui/core/mvc/Controller",
  "sap/ui/model/json/JSONModel",
  "sap/ui/model/Filter",
  "sap/ui/model/FilterOperator",
  "sap/m/MessageToast",
  "sap/m/MessageBox"
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
  "use strict";

  return Controller.extend("project2.controller.saisiereleve", {

    onInit: function () {
      var oViewModel = new JSONModel({
        ordres:        [],
        groupedOrdres: [],
        busy:          false,
        searchanlage:  "",
        currentGroupe: {}
      });
      this.getView().setModel(oViewModel, "viewModel");
    },

    _getODataModel: function () {
      return this.getOwnerComponent().getModel();
    },

    formatLeadingZeros: function (sValue) {
      if (!sValue) { return ""; }
      var parsed = parseInt(sValue, 10);
      return isNaN(parsed) ? sValue : String(parsed);
    },

    formatSapDate: function (sValue) {
      if (!sValue) { return ""; }
      var s = String(sValue).replace(/-/g, "");
      if (/^\d{8}$/.test(s)) {
        return s.slice(6, 8) + "/" + s.slice(4, 6) + "/" + s.slice(0, 4);
      }
      return sValue;
    },

    formatDernierIndex: function (sEntier, sDecPart) {
      if (sEntier === undefined || sEntier === null) { return ""; }
      var iEntier   = parseInt(sEntier, 10);
      var fDec      = parseFloat(sDecPart) || 0;
      var iCentimes = Math.round(fDec * 100);
      var sDec      = String(iCentimes).padStart(2, "0");
      return iEntier + "," + sDec;
    },

    _sapDateToIso: function (sValue) {
      if (!sValue) { return ""; }
      var s = String(sValue).replace(/-/g, "");
      if (/^\d{8}$/.test(s)) {
        return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
      }
      return sValue;
    },

    _buildGroupedOrdres: function (aOrdres) {
      var oMap    = {};
      var aGroups = [];
      var sToday  = new Date().toISOString().split("T")[0];

      aOrdres.forEach(function (oOrdre) {
        var sKey = [
          oOrdre.VSTELLE,
          oOrdre.anlage,
          oOrdre.Gernr,
          oOrdre.Equnr,
          oOrdre.Adatsoll
        ].join("|");

        if (!oMap[sKey]) {
          var oGroup = {
            VSTELLE:      oOrdre.VSTELLE,
            anlage:       oOrdre.anlage,
            Gernr:        oOrdre.Gernr,
            Equnr:        oOrdre.Equnr,
            Adatsoll:     oOrdre.Adatsoll,
            cadransLabel: "",
            cadrans:      []
          };
          oMap[sKey] = oGroup;
          aGroups.push(oGroup);
        }

        var sDateReleve = this._sapDateToIso(oOrdre.Adatsoll) || sToday;

        oMap[sKey].cadrans.push({
          Ablbelnr:       oOrdre.Ablbelnr,
          Zwnummer:       oOrdre.Zwnummer,
          dernierindex:   oOrdre.dernierindex,
          denierindexapv: oOrdre.denierindexapv,
          Massread:       oOrdre.Massread,
          IndexReleve:    "",
          VZwstand:       "",
          NZwstand:       "",
          Consommation:   "",
          ConsoState:     "None",
          IndexState:     "None",
          DateReleve:     sDateReleve,
          DateState:      "None"
        });
      }.bind(this));

      aGroups.forEach(function (oGroup) {
        oGroup.cadransLabel = oGroup.cadrans
          .map(function (c) { return c.Zwnummer; })
          .join(", ");
      });

      return aGroups;
    },

    onSearch: function () {
      var oViewModel = this.getView().getModel("viewModel");
      var sanlage    = oViewModel.getProperty("/searchanlage").trim();
      var aFilters   = [];

      aFilters.push(new Filter("ablstat", FilterOperator.EQ, "0"));
      if (sanlage) {
        aFilters.push(new Filter("anlage", FilterOperator.EQ, sanlage));
      }

      oViewModel.setProperty("/busy",          true);
      oViewModel.setProperty("/ordres",        []);
      oViewModel.setProperty("/groupedOrdres", []);

      this._getODataModel().read("/saisieReleveSet", {
        filters: aFilters,
        success: function (oData) {
          var aGrouped = this._buildGroupedOrdres(oData.results);
          oViewModel.setProperty("/ordres",        oData.results);
          oViewModel.setProperty("/groupedOrdres", aGrouped);
          oViewModel.setProperty("/busy",          false);
          if (!aGrouped.length) {
            MessageToast.show("Aucun ordre trouvé.");
          }
        }.bind(this),
        error: function (oError) {
          oViewModel.setProperty("/busy", false);
          MessageBox.error("Erreur OData : " + oError.message);
        }
      });
    },

    onReset: function () {
      var oViewModel = this.getView().getModel("viewModel");
      oViewModel.setProperty("/searchanlage",  "");
      oViewModel.setProperty("/ordres",        []);
      oViewModel.setProperty("/groupedOrdres", []);
    },

    onRowPress: function (oEvent) {
      var oCtx = oEvent.getSource().getBindingContext("viewModel");
      this._openDialogByPath(oCtx.getPath());
    },

    _openDialogByPath: function (sPath) {
      var oGroupe = this.getView().getModel("viewModel").getProperty(sPath);
      this._openDialog(oGroupe);
    },

    _openDialog: function (oGroupe) {
      var aCadrans    = Array.isArray(oGroupe.cadrans) ? oGroupe.cadrans : [];
      var sToday      = new Date().toISOString().split("T")[0];
      var sDateReleve = this._sapDateToIso(oGroupe.Adatsoll) || sToday;

      var oEntry = {
        VSTELLE:  oGroupe.VSTELLE,
        anlage:   oGroupe.anlage,
        Gernr:    oGroupe.Gernr,
        Equnr:    oGroupe.Equnr,
        Adatsoll: oGroupe.Adatsoll,
        cadrans:  aCadrans.map(function (c) {
          return {
            Ablbelnr:       c.Ablbelnr,
            Zwnummer:       c.Zwnummer,
            dernierindex:   c.dernierindex,
            denierindexapv: c.denierindexapv,
            Massread:       c.Massread,
            IndexReleve:    "",
            VZwstand:       "",
            NZwstand:       "",
            Consommation:   "",
            ConsoState:     "None",
            IndexState:     "None",
            DateReleve:     sDateReleve,
            DateState:      "None"
          };
        })
      };

      this.getView().getModel("viewModel").setProperty("/currentGroupe", oEntry);
      this.byId("dialogSaisie").open();
    },

    onCadranIndexChange: function (oEvent) {
      var sPath  = oEvent.getSource().getBindingContext("viewModel").getPath();
      var oModel = this.getView().getModel("viewModel");

      var sRaw     = (oModel.getProperty(sPath + "/IndexReleve") || "").replace(",", ".");
      var fNouveau = parseFloat(sRaw);

      if (isNaN(fNouveau) || fNouveau < 0) {
        oModel.setProperty(sPath + "/IndexState",   "Error");
        oModel.setProperty(sPath + "/Consommation", "");
        oModel.setProperty(sPath + "/ConsoState",   "None");
        oModel.setProperty(sPath + "/VZwstand",     "");
        oModel.setProperty(sPath + "/NZwstand",     "");
        return;
      }

      oModel.setProperty(sPath + "/IndexState", "None");

      var iVZw = Math.floor(fNouveau);
      var fNZw = parseFloat((fNouveau - iVZw).toFixed(2));
      oModel.setProperty(sPath + "/VZwstand", iVZw);
      oModel.setProperty(sPath + "/NZwstand", fNZw);

      var iEntier    = parseInt(oModel.getProperty(sPath + "/dernierindex")     || 0, 10);
      var fDecPart   = parseFloat(oModel.getProperty(sPath + "/denierindexapv") || 0);
      var iCentimes  = Math.round(fDecPart * 100);
      var fPrecedent = parseFloat(iEntier + "." + String(iCentimes).padStart(2, "0"));

      var fConso = parseFloat((fNouveau - fPrecedent).toFixed(2));
      oModel.setProperty(sPath + "/Consommation", String(fConso).replace(".", ","));
      oModel.setProperty(sPath + "/ConsoState",   fConso < 0 ? "Error" : "Success");
    },

    onEstimerIndex: function () {
      var oViewModel = this.getView().getModel("viewModel");
      var oGroupe    = oViewModel.getProperty("/currentGroupe");

      oViewModel.setProperty("/busy", true);

      this._getODataModel().create("/saisieReleveSet", {
        anlage:   oGroupe.anlage,
        Adatsoll: oGroupe.Adatsoll
      }, {
        success: function () {

          
          var aFilters = [
            new Filter("anlage",   FilterOperator.EQ, oGroupe.anlage),
            new Filter("Adatsoll", FilterOperator.EQ, oGroupe.Adatsoll)
          ];

          this._getODataModel().read("/saisieReleveSet", {
            filters: aFilters,
            success: function (oData) {
              oViewModel.setProperty("/busy", false);

              if (!oData.results || !oData.results.length) {
                MessageToast.show("Aucun index trouvé après estimation.");
                return;
              }

              var aCadrans = oViewModel.getProperty("/currentGroupe/cadrans") || [];

              aCadrans.forEach(function (oCadran, i) {
                var sBase = "/currentGroupe/cadrans/" + i;

                
                var oResult = oData.results.find(function (r) {
                  return r.Ablbelnr === oCadran.Ablbelnr;
                });

                if (!oResult) { return; }

                var iEntier   = parseInt(oResult.VZwstand || "0", 10);
                var fDec      = parseFloat(oResult.NZwstand || "0");
                var iCentimes = Math.round(fDec * 100);
                var sDec      = String(iCentimes).padStart(2, "0");
                var sIndex    = iEntier + "," + sDec;

                oViewModel.setProperty(sBase + "/VZwstand",    iEntier);
                oViewModel.setProperty(sBase + "/NZwstand",    fDec);
                oViewModel.setProperty(sBase + "/IndexReleve", sIndex);
                oViewModel.setProperty(sBase + "/IndexState",  "None");

              
                var iEntierPrec   = parseInt(oCadran.dernierindex     || 0, 10);
                var fDecPrec      = parseFloat(oCadran.denierindexapv || 0);
                var iCentimesPrec = Math.round(fDecPrec * 100);
                var fPrecedent    = parseFloat(iEntierPrec + "." + String(iCentimesPrec).padStart(2, "0"));
                var fNouveau      = parseFloat(iEntier     + "." + String(iCentimes).padStart(2, "0"));
                var fConso        = parseFloat((fNouveau - fPrecedent).toFixed(2));

                oViewModel.setProperty(sBase + "/Consommation", String(fConso).replace(".", ","));
                oViewModel.setProperty(sBase + "/ConsoState",   fConso < 0 ? "Error" : "Success");
              });

              MessageToast.show("Index estimés.");
            }.bind(this),

            error: function () {
              oViewModel.setProperty("/busy", false);
              MessageBox.error("Erreur lors de la lecture des index estimés.");
            }
          });
        }.bind(this),

        error: function (oError) {
          oViewModel.setProperty("/busy", false);
          var sMsg = "Erreur lors de l'estimation.";
          try {
            var oBody = JSON.parse(oError.responseText);
            sMsg = oBody.error && oBody.error.message
              ? oBody.error.message.value : sMsg;
          } catch (e) { /* ignore */ }
          MessageBox.error(sMsg);
        }
      });
    },

    onValiderSaisie: function () {
      MessageBox.success("Saisie enregistrée avec succès.", {
        onClose: function () {
          this.byId("dialogSaisie").close();
          this.onSearch();
        }.bind(this)
      });
    },

    onCancelSaisie: function () {
      this.byId("dialogSaisie").close();
    }

  });
});
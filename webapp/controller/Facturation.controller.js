// Déclaration du contrôleur et des classes UI5 utilisées
sap.ui.define([
    "sap/ui/core/mvc/Controller",     // Classe de base d'un contrôleur
    "sap/ui/model/json/JSONModel",    // Modèle JSON local
    "sap/ui/model/Filter",            // Filtres pour les requêtes OData
    "sap/ui/model/FilterOperator",    // Opérateurs de filtre (EQ, GT...)
    "sap/m/MessageToast",             // Petit message temporaire
    "sap/m/MessageBox"                // Boîte de dialogue (erreur, confirmation...)
], function (Controller, JSONModel, Filter, FilterOperator, MessageToast, MessageBox) {
    "use strict";

    return Controller.extend("project2.controller.Facturation", {

        // Exécuté une seule fois, à la création de la vue
        onInit: function () {
            // Modèle local qui contiendra la liste des documents affichés dans le tableau
            var oModel = new JSONModel({ documents: [] });
            this.getView().setModel(oModel, "factureModel");

            this._pendingBelnr = null; // Document à sélectionner après une recherche
            this._lastFilters  = [];   // Mémorise les derniers filtres pour rafraîchir

            // Appelle _onRouteMatched à chaque arrivée sur cette page
            var oRouter = sap.ui.core.UIComponent.getRouterFor(this);
            oRouter.getRoute("RouteFacturation").attachMatched(this._onRouteMatched, this);
        },

        // Appelé quand on arrive sur la page (éventuellement avec des paramètres dans l'URL)
        _onRouteMatched: function (oEvent) {
            // Récupère les paramètres de l'URL (?Vkonto=...)
            var oQuery  = oEvent.getParameter("arguments")["?query"] || {};
            var sVkonto = oQuery.Vkonto || "";

            // Si un compte contrat est passé, on le remplit et on lance la recherche
            if (sVkonto) {
                this.byId("inputVkont").setValue(sVkonto);
                this.byId("inputPartner").setValue("");
                this.onSearchDocuments();
            }
        },

        // Bouton retour : revient à l'accueil du Fiori Launchpad
        onNavBack: function () {
            var oCrossAppNav = sap.ushell.Container.getService("CrossApplicationNavigation");
            oCrossAppNav.toExternal({
                target: { shellHash: "#Shell-home" }
            });
        },

        // Quand on tape dans un champ, on vide l'autre (un seul critère à la fois)
        onClearOther: function (oEvent) {
            var sId = oEvent.getSource().getId();
            if (sId.includes("inputPartner")) {
                this.byId("inputVkont").setValue("");
            } else {
                this.byId("inputPartner").setValue("");
            }
        },

        // Complète le partenaire avec des zéros à gauche (format SAP sur 10 caractères)
        _formatPartner: function (sValue) {
            if (!sValue) { return ""; }
            return sValue.trim().padStart(10, "0");
        },

        // Complète le compte contrat avec des zéros à gauche (format SAP sur 12 caractères)
        _formatVkont: function (sValue) {
            if (!sValue) { return ""; }
            return sValue.trim().padStart(12, "0");
        },

        // Bouton Rechercher : prépare les filtres puis lance la recherche
        onSearchDocuments: function () {
            var sPartner = this._formatPartner(this.byId("inputPartner").getValue());
            var sVkont   = this._formatVkont(this.byId("inputVkont").getValue());

            // Aucun critère saisi : on affiche un message et on s'arrête
            if (!sPartner && !sVkont) {
                MessageToast.show("Veuillez saisir un Partenaire ou un compte Contrat.");
                return;
            }

            // Construction des filtres selon le champ rempli
            var aFilters = [];
            if (sPartner) {
                aFilters.push(new Filter("Gpartner", FilterOperator.EQ, sPartner));
            }
            if (sVkont) {
                aFilters.push(new Filter("Vkont", FilterOperator.EQ, sVkont));
            }

            this._lastFilters = aFilters; // On garde les filtres pour un futur rafraîchissement
            this._executeSearch(aFilters);
        },

        // Appelle le service OData pour récupérer les documents à facturer
        _executeSearch: function (aFilters) {
            var oModel     = this.getView().getModel("factureModel"); // Modèle local (tableau)
            var oDataModel = this.getView().getModel();               // Modèle OData (backend SAP)

            this._setBusy(true); // Affiche l'indicateur de chargement

            // Lecture (GET) de l'EntitySet avec les filtres
            oDataModel.read("/doctemporairepourfacturationSet", {
                filters: aFilters,
                success: function (oData) {
                    this._setBusy(false);
                    // On place les résultats dans le modèle local -> le tableau se met à jour
                    oModel.setProperty("/documents", oData.results);

                    if (oData.results.length === 0) {
                        MessageToast.show("Aucun document trouvé.");
                    }

                    // Si un document devait être sélectionné, on le sélectionne
                    if (this._pendingBelnr) {
                        this._selectRow(this._pendingBelnr);
                        this._pendingBelnr = null;
                    }
                }.bind(this),
                error: function (oError) {
                    this._setBusy(false);
                    // Affiche le message d'erreur renvoyé par SAP
                    MessageBox.error(
                        this._parseErrorMessage(oError, "Erreur lors de la recherche des documents.")
                    );
                }.bind(this)
            });
        },

        // Active ou désactive l'indicateur de chargement sur la vue
        _setBusy: function (bBusy) {
            this.getView().setBusy(bBusy);
        },

        // Bouton Facturer : vérifie la sélection puis demande confirmation
        onFacturer: function () {
            var oTable         = this.byId("documentsTable");
            var aSelectedItems = oTable.getSelectedItems();

            // Aucune ligne cochée
            if (aSelectedItems.length === 0) {
                MessageToast.show("Veuillez sélectionner au moins un document.");
                return;
            }

            // Récupère les données de chaque ligne sélectionnée
            var aDocs = aSelectedItems.map(function (oItem) {
                return oItem.getBindingContext("factureModel").getObject();
            });

            // Message différent selon qu'il y a 1 ou plusieurs documents
            var sMsg = aDocs.length === 1
                ? "Confirmer la création de la facture pour le document " + aDocs[0].Belnr + " ?"
                : "Confirmer la création d'une seule facture globale pour les " + aDocs.length + " documents sélectionnés ?";

            // Boîte de confirmation : si OK, on crée la facture
            MessageBox.confirm(sMsg, {
                title: "Confirmation",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._createSingleFactureForMultipleDocs(aDocs);
                    }
                }.bind(this)
            });
        },

        // Crée une seule facture pour tous les documents sélectionnés
        _createSingleFactureForMultipleDocs: function (aDocs) {
            this._setBusy(true);
            var oModel   = this.getView().getModel();
            var sPartner = aDocs[0].Gpartner; // Partenaire du 1er document
            var sVkont   = aDocs[0].Vkont;    // Compte contrat du 1er document
            var aBelnr   = aDocs.map(function (doc) { return doc.Belnr; }); // Liste des n° de documents
            var sDocList = aBelnr.join(",");  // Ex : "100,101,102"

            // Appel OData en création (POST) sur factureSet
            oModel.create("/factureSet", {
                Opbel:   aBelnr[0],
                Partner: sPartner,
                Vkont:   sVkont
            }, {
                // La liste complète des documents est envoyée dans un en-tête HTTP
                headers: { "x-doc-list": sDocList },
                success: function (oData) {
                    this._setBusy(false);

                    // Numéro de pièce renvoyé par SAP, complété à 12 caractères
                    var sOpbelRaw = oData.Opbel ? String(oData.Opbel).trim() : "";
                    var sOpbel    = sOpbelRaw ? sOpbelRaw.padStart(12, "0") : "";

                    // Logs de debug dans la console
                    console.log("=== FACTURATION SUCCESS ===");
                    console.log("Opbel brut      :", oData.Opbel);
                    console.log("Opbel formaté   :", sOpbel);

                    // Pas de numéro de pièce renvoyé : message simple puis rafraîchissement
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

        // Vérifie dans SAP que la facture créée existe bien
        _checkOpbelAndShowDialog: function (sOpbel) {
            this._setBusy(true);
            var oModel  = this.getView().getModel();
            var aFilter = [new Filter("Opbel", FilterOperator.EQ, sOpbel)];

            // Logs de debug
            console.log("=== VERIFICATION OPBEL (GET_ENTITYSET) ===");
            console.log("Filtre Opbel :", sOpbel);

            // Lecture de l'EntitySet de vérification filtrée sur le n° de pièce
            oModel.read("/verificationdesfacturesSet", {
                filters: aFilter,
                success: function (oData) {
                    this._setBusy(false);
                    console.log("Résultats :", JSON.stringify(oData));
                    // true si au moins un résultat est trouvé
                    var bExiste = !!(oData.results && oData.results.length > 0);
                    console.log("bExiste :", bExiste);
                    this._showSuccessDialog(sOpbel, bExiste);
                }.bind(this),
                error: function (oErr) {
                    this._setBusy(false);
                    console.warn("Erreur vérification :", oErr.statusCode, oErr.message);
                    // En cas d'erreur, on considère que la pièce n'est pas trouvée
                    this._showSuccessDialog(sOpbel, false);
                }.bind(this)
            });
        },

        // Affiche le message de succès, avec un bouton "Valider" si la pièce existe
        _showSuccessDialog: function (sOpbel, bExiste) {
            console.log("=== SHOW DIALOG === bExiste:", bExiste, "| sOpbel:", sOpbel);

            var sMsg        = "Facture globale créée avec succès.\nPièce générée : " + sOpbel;
            // Boutons proposés : "Valider" + "Fermer", ou seulement "Fermer"
            var aActions    = bExiste
                              ? ["Valider", MessageBox.Action.CLOSE]
                              : [MessageBox.Action.CLOSE];
            // Bouton mis en avant
            var sEmphasized = bExiste ? "Valider" : MessageBox.Action.CLOSE;

            MessageBox.success(sMsg, {
                title: "Facturation réussie",
                actions: aActions,
                emphasizedAction: sEmphasized,
                onClose: function (sAction) {
                    console.log("Action choisie :", sAction);
                    // Clic sur "Valider" : on va à l'écran de validation
                    if (sAction === "Valider" && bExiste) {
                        this._navigateToValidation(sOpbel);
                    }
                    // Dans tous les cas, on rafraîchit la liste des documents
                    this._refreshAfterCreate();
                }.bind(this)
            });
        },

        // Extrait un message d'erreur lisible depuis la réponse du serveur
        _parseErrorMessage: function (oError, sDefaultMsg) {
            var sMsg = sDefaultMsg || "Erreur inconnue";

            try {
                var sResponseText = oError.responseText || "";

                // Réponse au format XML
                if (sResponseText.trim().startsWith("<")) {
                    var oParser  = new DOMParser();
                    var oXmlDoc  = oParser.parseFromString(sResponseText, "text/xml");
                    // On cherche la balise qui contient le message
                    var oMsgNode = oXmlDoc.querySelector("message")
                                || oXmlDoc.querySelector("Message")
                                || oXmlDoc.querySelector("error > message");
                    sMsg = (oMsgNode && oMsgNode.textContent)
                           ? oMsgNode.textContent.trim()
                           : "Erreur serveur";
                } else {
                    // Réponse au format JSON
                    var oResp = JSON.parse(sResponseText);
                    var oErr  = oResp.error;
                    // On prend d'abord le message détaillé, sinon le message principal
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
                // Lecture impossible : on affiche le texte brut ou le message par défaut
                sMsg = oError.responseText || sDefaultMsg;
            }

            return sMsg;
        },

        // Relance la dernière recherche pour mettre à jour le tableau
        _refreshAfterCreate: function () {
            if (this._lastFilters && this._lastFilters.length > 0) {
                this._executeSearch(this._lastFilters);
            } else {
                this.onSearchDocuments();
            }
        },

        // Sélectionne et affiche la ligne correspondant à un n° de document
        _selectRow: function (sBelnr) {
            var oTable = this.byId("documentsTable");

            // Petit délai pour laisser le tableau s'afficher
            setTimeout(function () {
                oTable.removeSelections(true); // On décoche tout
                oTable.getItems().forEach(function (oItem) {
                    var sItemBelnr = oItem.getBindingContext("factureModel").getProperty("Belnr");
                    if (sItemBelnr === sBelnr) {
                        oTable.setSelectedItem(oItem, true); // On coche la ligne
                        // On fait défiler la page jusqu'à la ligne
                        var oDomRef = oItem.getDomRef();
                        if (oDomRef) {
                            oDomRef.scrollIntoView({ behavior: "smooth", block: "center" });
                        }
                        oItem.focus();
                    }
                });
            }, 300);
        },

        // Ouvre l'écran de validation en passant le n° de pièce dans l'URL
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

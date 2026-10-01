// Déclaration du module UI5 avec ses dépendances
sap.ui.define([
    "sap/ui/model/json/JSONModel", // Modèle de données au format JSON
    "sap/ui/Device"                // Infos sur l'appareil (téléphone, tablette, PC...)
],
function (JSONModel, Device) {
    "use strict"; // Mode strict : signale plus d'erreurs dans le code

    // Objet renvoyé par le module, utilisable dans les autres fichiers
    return {

        // Crée un modèle qui contient les infos de l'appareil
        createDeviceModel: function () {

            // On place les infos de l'appareil dans un modèle JSON
            var oModel = new JSONModel(Device);

            // Lecture seule : la vue lit le modèle mais ne le modifie pas
            oModel.setDefaultBindingMode("OneWay");

            // On renvoie le modèle pour l'utiliser dans le Component
            return oModel;
        }
    };
});

var express = require("express");
var router = express.Router();
const { tokenVerifierMW } = require("../middleware/tokenAuth");
const { getUserDataMW } = require("../middleware/getUserData");
const checkBodyMW = require("../middleware/checkBody");
const Crew = require("../models/crews");
const User = require("../models/users");
const { populateCrew } = require("../models/pipelines/population");
const isUserCrewAdminMW = require("../middleware/isUserCrewAdmin");

/*
### Crew (/crew)  
- GET /:crewID 🔒 PROTEGE  
  *Description* : Récupération des données d'un crew.  
  *Réponse* :  
  - Succès : `{ result: true, data: crew }`  
  - Erreur : `404` (crew non trouvé).  

- POST / 🔒 PROTEGE  
  *Champs obligatoires : `name`*  
  *Description* : Création d'un nouveau crew.  
  *Réponse* :  
  - Succès : `{ result: true, data: newCrew }`  
  - Erreur : `400` (déjà dans un crew).  

- PUT /promote/:targetUserID 🔒 PROTEGE 🛡️ ADMIN  
  *Description* : Promouvoir un membre en admin.  
  *Réponse* :  
  - Succès : `{ result: true }`  
  - Erreur : `400` (échec de promotion).  

- PUT /demote/:targetUserID 🔒 PROTEGE 🛡️ ADMIN  
  *Description* : Rétrograder un admin.  
  *Réponse* :  
  - Succès : `{ result: true }`  
  - Erreur : `400` (échec de rétrogradation).  

- PUT /add/:targetUserID 🔒 PROTEGE 🛡️ ADMIN  
  *Description* : Ajouter un utilisateur au crew.  
  *Réponse* :  
  - Succès : `{ result: true }`  
  - Erreur : `400` (utilisateur déjà dans un crew).  

- PUT /remove/:targetUserID 🔒 PROTEGE 🛡️ ADMIN  
  *Description* : Retirer un utilisateur du crew.  
  *Réponse* :  
  - Succès : `{ result: true }`  
  - Erreur : `400` (échec de suppression).  

- PUT /leave 🔒 PROTEGE  
  *Description* : Quitter son crew.  
  *Réponse* :  
  - Succès : `{ result: true }`  
  - Erreurs : `400` (non membre ou erreur).  

*/

router.get("/:crewID", tokenVerifierMW, async (req, res) => {
  const { crewID } = req.params;
  const data = await Crew.findOne({ _id: crewID });
  if (!data) {
    res.status(404).json({
      result: false,
      reason: "Crew not found.",
    });
    return;
  }
  await Crew.populate(data, populateCrew);
  res.json({
    result: true,
    data,
  });
});

router.post(
  "/",
  checkBodyMW("name"),
  tokenVerifierMW,
  getUserDataMW("crew", "uID"),
  async (req, res) => {
    const { name, userData } = req.body;
    if (userData.crew) {
      res.json({
        result: false,
        reason: "Allready part of one crew.",
      });
      return;
    }
    const newCrew = new Crew({
      name,
      creationDate: Date.now(),
      members: [userData._id],
      admins: [userData.uID],
    });
    try {
      const { _id } = await newCrew.save();
      await User.updateOne({ _id: userData._id }, { crew: _id });
      res.json({
        result: true,
        data: newCrew,
      });
    } catch (error) {
      res.json({
        result: false,
        error,
      });
    }
  }
);

router.put(
  "/promote/:targetUserID",
  tokenVerifierMW,
  getUserDataMW("crew", "uID"),
  isUserCrewAdminMW,
  async (req, res) => {
    const { userData } = req.body;
    const { targetUserID } = req.params;
    const { _id: targetMongoID } = await User.findOne({ uID: targetUserID });

    const { matchedCount } = await Crew.updateOne(
      { _id: userData.crew },
      {
        $addToSet: {
          members: targetMongoID,
          admins: targetUserID,
        },
      }
    );
    if (matchedCount) {
      res.json({
        result: true,
      });
      return;
    }
    res.status(400).json({
      result: false,
      reason: "Error while promoting user to admin",
    });
  }
);

router.put(
  "/demote/:targetUserID",
  tokenVerifierMW,
  getUserDataMW("crew", "uID"),
  isUserCrewAdminMW,
  async (req, res) => {
    const { userData } = req.body;
    const { targetUserID } = req.params;
    const { _id: targetMongoID } = await User.findOne({ uID: targetUserID });
    const { matchedCount } = await Crew.updateOne(
      { _id: userData.crew },
      {
        $pull: {
          admins: targetUserID,
        },
      }
    );
    if (matchedCount) {
      res.json({
        result: true,
      });
      return;
    }
    res.status(400).json({
      result: false,
      reason: "Error while demoting user from admin",
    });
  }
);

router.put(
  "/add/:targetUserID",
  tokenVerifierMW,
  getUserDataMW("crew", "uID"),
  isUserCrewAdminMW,
  async (req, res) => {
    const { userData } = req.body;
    const { targetUserID } = req.params;
    const { _id: targetMongoID } = await User.findOne({ uID: targetUserID });

    //Vérifie que l'utilisateur cible ne fait pas déja parti d'un crew
    const { crew } = await User.find({ uID: targetUserID });
    if (crew) {
      res.status(400).json({
        result: false,
        reason: "User is allready part of a crew.",
      });
      return;
    }
    try {
      const { matchedCount } = await Crew.updateOne(
        { _id: userData.crew },
        { $addToSet: { members: targetMongoID } }
      );
      if (matchedCount) {
        //Ajoute le crew au profil de l'utilisateur cible
        await User.updateOne(
          { _id: targetMongoID },
          { $set: { crew: userData.crew } }
        );
        res.json({
          result: true,
        });
        return;
      }
      res.status(400).json({
        result: false,
        reason: "Error while adding user to crew",
      });
    } catch (error) {
      res.status(400).json({
        result: false,
        reason: "Error while adding user to crew",
        error,
      });
    }
  }
);

router.put(
  "/remove/:targetUserID",
  tokenVerifierMW,
  getUserDataMW("crew", "uID"),
  isUserCrewAdminMW,
  async (req, res) => {
    const { userData } = req.body;
    const { targetUserID } = req.params;
    const { _id: targetMongoID } = await User.findOne({ uID: targetUserID });
    const { matchedCount } = await Crew.updateOne(
      { _id: userData.crew },
      { $pull: { members: targetMongoID, admins: targetUserID } }
    );
    try {
      if (matchedCount) {
        //Retire le crew de l'utilisateur cible
        await User.updateOne({ _id: targetMongoID }, { $unset: { crew: "" } });
        res.json({
          result: true,
        });
        return;
      }
      res.status(400).json({
        result: false,
        reason: "Error while removing user from crew",
      });
    } catch (error) {
      res.status(400).json({
        result: false,
        reason: "Error while adding usremoving from crew",
        error,
      });
    }
  }
);

router.put(
  "/leave",
  tokenVerifierMW,
  getUserDataMW("crew", "uID"),
  async (req, res) => {
    const { _id, crew } = req.body.userData;
    if (!crew) {
      res.json({
        result: false,
        reason: "You're not part of any crew.",
      });
      return;
    }
    try {
      const { matchedCount } = await Crew.updateOne(
        { _id: crew },
        {
          $pull: {
            members: _id,
            admins: _id,
          },
        }
      );
      if (matchedCount) {
        await User.updateOne({ _id }, { $unset: { crew: "" } });
        res.json({ result: true });
        return;
      }
      res.json({ result: false, reason: "Bad crew Id" });
    } catch (error) {
      res.status(400).json({
        result: false,
        reason: "Error while leaving crew",
        error,
      });
    }
  }
);

module.exports = router;

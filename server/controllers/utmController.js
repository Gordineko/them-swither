import UTM from "../models/UTM.js";

export const registerUTM = async (req, res) => {
  try {
    console.log(req.body);
    const utmData = req.body;

    if (!Object.keys(utmData).length) {
      return res.status(400).json({ message: "UTM data is required" });
    }

    const newUTM = new UTM(utmData);
    await newUTM.save();

    res
      .status(201)
      .json({ message: "UTM data saved successfully", data: newUTM });
  } catch (error) {
    console.error("Error saving UTM data:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
};

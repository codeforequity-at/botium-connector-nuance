var AdmZip = require("adm-zip");


// creating archives
var zip = new AdmZip();

// add file directly
var content = "inner content of the file";
zip.addFile("test.txt", Buffer.from(content, "utf8"), "entry comment goes here");
// get everything as a buffer
var willSendthis = zip.toBuffer();
// or write everything to disk

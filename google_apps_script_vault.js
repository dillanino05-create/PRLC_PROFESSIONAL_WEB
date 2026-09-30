/**
 * ============================================================================
 * MecaPsi Google Drive Vault — Webhook Backend (5 TB) v3.5
 * ============================================================================
 * Script de Google Apps Script para almacenar permanentemente en Google Drive:
 * - Grabaciones de Video (.mp4)
 * - Reportes e Informes Excel (.xlsx)
 * - Informes Clínicos PDF (.pdf)
 *
 * Características clave:
 * 1. Acceso Público Inmediato: Asigna setSharing(ANYONE_WITH_LINK, VIEW) a cada archivo
 *    para que pueda reproducirse dentro del iframe web y descargarse sin solicitar login.
 * 2. Estructura Jerárquica: MecaPsi_Cloud_Vault / {Psicólogo} / {Paciente} / {Prueba} / [Videos|Excels|PDFs]
 * 3. Reparación de Permisos: Función 'fix_permissions' para desbloquear todos los archivos antiguos.
 */

var VAULT_TOKEN = "MECAPSI_DRIVE_VAULT_2026";
var ROOT_VAULT_NAME = "MecaPsi_Cloud_Vault";

function doGet(e) {
  var params = e ? e.parameter : {};
  
  // Acción 1: Reparar permisos de todos los archivos existentes en la bóveda
  if (params && params.action === "fix_permissions") {
    if (params.token !== VAULT_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, error: "Token inválido" }))
        .setMimeType(ContentService.MimeType.JSON);
    }
    var count = fixAllVaultPermissions();
    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: "Permisos actualizados a lectura pública en toda la bóveda",
      updated_files: count
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // Acción 2: Estado del servicio
  return ContentService.createTextOutput(JSON.stringify({
    status: "online",
    service: "MecaPsi Google Drive Vault",
    account: Session.getActiveUser().getEmail() || "mundodejordi@gmail.com",
    storage: "5 TB Disponibles",
    version: "3.5"
  })).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ success: false, error: "Cuerpo de solicitud vacío" });
    }

    var data = JSON.parse(e.postData.contents);

    // Validación de Token de Seguridad
    if (data.token !== VAULT_TOKEN) {
      return responseJSON({ success: false, error: "Token de autenticación de Vault inválido" });
    }

    // Acción especial: Reparar permisos desde POST
    if (data.action === "fix_permissions") {
      var fixedCount = fixAllVaultPermissions();
      return responseJSON({ success: true, updated_files: fixedCount });
    }

    if (!data.file_base64) {
      return responseJSON({ success: false, error: "Falta file_base64" });
    }

    // Carpeta Raíz Maestra: MecaPsi_Cloud_Vault
    var rootFolder = getOrCreateFolder(DriveApp.getRootFolder(), ROOT_VAULT_NAME);
    try {
      rootFolder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(errRoot) {}

    // Subcarpetas jerárquicas: Psicólogo / Paciente / Tipo_Prueba / [Videos|Excels|PDFs]
    var psychName = (data.psychologist || "Psicologo_General").replace(/[\/\\:*?"<>|]/g, "_");
    var patientId = (data.patient_id || "PAC_ANONIMO").replace(/[\/\\:*?"<>|]/g, "_");
    var testType = (data.test_type || "PLC").toUpperCase();
    var testFolderLabel = (testType === "CORSI" || testType === "CBT") ? "CBT_Bloques_Corsi" : "PLC_Atencion_d2";
    var fileType = (data.file_type || "video").toLowerCase();
    
    var subCategory = "Videos";
    var defaultExt = ".mp4";
    var mime = data.mime_type || "video/mp4";

    if (fileType === "excel") {
      subCategory = "Excels";
      defaultExt = ".xlsx";
      mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    } else if (fileType === "pdf") {
      subCategory = "PDFs";
      defaultExt = ".pdf";
      mime = "application/pdf";
    }

    var fPsych = getOrCreateFolder(rootFolder, psychName);
    var fPatient = getOrCreateFolder(fPsych, patientId);
    var fTest = getOrCreateFolder(fPatient, testFolderLabel);
    var fTarget = getOrCreateFolder(fTest, subCategory);

    // Nombre de archivo sanitizado
    var rawName = (data.file_name || ("Sesion_" + new Date().getTime() + defaultExt)).replace(/[\/\\:*?"<>|]/g, "_");
    if (!rawName.toLowerCase().endsWith(defaultExt)) {
      rawName += defaultExt;
    }

    // Decodificar Base64 y crear archivo
    var bytes = Utilities.base64Decode(data.file_base64);
    var blob = Utilities.newBlob(bytes, mime, rawName);
    var file = fTarget.createFile(blob);

    // CRUCIAL: Otorgar permiso de lectura pública por enlace para permitir reproducción web y descarga directa
    try {
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    } catch(shareErr) {
      console.warn("Aviso asignando sharing público:", shareErr);
    }

    var fileId = file.getId();
    var fileUrl = file.getUrl();
    var folderPath = ROOT_VAULT_NAME + "/" + psychName + "/" + patientId + "/" + testFolderLabel + "/" + subCategory;

    return responseJSON({
      success: true,
      file_id: fileId,
      file_name: rawName,
      file_url: fileUrl,
      preview_url: "https://drive.google.com/file/d/" + fileId + "/preview",
      download_url: "https://drive.google.com/uc?export=download&id=" + fileId,
      folder_path: folderPath,
      size_bytes: bytes.length
    });

  } catch (err) {
    return responseJSON({ success: false, error: err.toString() });
  }
}

function getOrCreateFolder(parent, name) {
  var it = parent.getFoldersByName(name);
  if (it.hasNext()) {
    var f = it.next();
    try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}
    return f;
  }
  var newF = parent.createFolder(name);
  try { newF.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}
  return newF;
}

function fixAllVaultPermissions() {
  var count = 0;
  var rootIt = DriveApp.getFoldersByName(ROOT_VAULT_NAME);
  if (!rootIt.hasNext()) return 0;
  var root = rootIt.next();
  try { root.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(e){}

  function recurse(folder) {
    var files = folder.getFiles();
    while (files.hasNext()) {
      var file = files.next();
      try {
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        count++;
      } catch(e) {}
    }
    var subfolders = folder.getFolders();
    while (subfolders.hasNext()) {
      var sub = subfolders.next();
      try {
        sub.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      } catch(e) {}
      recurse(sub);
    }
  }

  recurse(root);
  return count;
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

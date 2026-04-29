import { sanitizeForLog } from "../utils/security";

// Servicio compartido para exportar la vista del informe sin cargar librerías pesadas en el render inicial.

const buildExportRows = (records, getUserName) => {
  return records.map((item) => ({
    Fecha: item.fecha || "",
    "Realizado Por":
      typeof getUserName === "function" ? getUserName(item.realizadopor) : item.realizadopor || "",
    Dirección: item.direccion || "",
    "Método de Pago": item.metododepago || "",
    Efectivo: item.efectivo || "",
    Saldo: item.saldo !== undefined ? Number(item.saldo).toFixed(2) : "0.00",
  }));
};

const buildExportColumns = () => [
  "Fecha",
  "Realizado Por",
  "Dirección",
  "Método de Pago",
  "Efectivo",
  "Saldo",
];

const downloadBlob = (blob, fileName) => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
};

const loadExcelJS = async () => {
  const excelModule = await import("exceljs");
  return excelModule.default ?? excelModule;
};

const loadJsPDF = async () => {
  const pdfModule = await import("jspdf");
  return pdfModule.jsPDF;
};

const loadAutoTable = async () => {
  const autoTableModule = await import("jspdf-autotable");
  return autoTableModule.default ?? autoTableModule.autoTable ?? autoTableModule;
};

// Exporta el informe a Excel con una carga diferida de ExcelJS.
export const exportInformeXlsx = async ({
  records = [],
  getUserName,
  fileName = "Informe De Efectivo.xlsx",
} = {}) => {
  try {
    const ExcelJS = await loadExcelJS();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Data");
    const headers = buildExportColumns();
    const exportRows = buildExportRows(records, getUserName);

    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF4F81BD" },
      };
      cell.alignment = { horizontal: "center", vertical: "middle" };
      cell.border = {
        top: { style: "thin" },
        left: { style: "thin" },
        bottom: { style: "thin" },
        right: { style: "thin" },
      };
    });

    worksheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: 1, column: headers.length },
    };

    worksheet.columns = [
      { width: 15 },
      { width: 20 },
      { width: 30 },
      { width: 20 },
      { width: 15 },
      { width: 15 },
    ];

    exportRows.forEach((rowData) => {
      const row = worksheet.addRow(Object.values(rowData));
      row.eachCell((cell) => {
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    downloadBlob(blob, fileName);
    return true;
  } catch (error) {
    console.error("Error exporting informe to XLSX:", sanitizeForLog(error.message));
    return false;
  }
};

// Exporta el informe a PDF con una carga diferida de jsPDF y autoTable.
export const exportInformePdf = async ({
  records = [],
  getUserName,
  title = "Informe De Efectivo",
  fileName = "Informe De Efectivo.pdf",
} = {}) => {
  try {
    const jsPDF = await loadJsPDF();
    const autoTable = await loadAutoTable();
    const doc = new jsPDF("p", "mm", "a4");
    const headers = [buildExportColumns()];
    const body = buildExportRows(records, getUserName).map((rowData) => Object.values(rowData));

    doc.setFontSize(16);
    doc.text(title, 105, 20, { align: "center" });
    doc.setFontSize(10);

    autoTable(doc, {
      head: headers,
      body,
      startY: 30,
      theme: "grid",
      headStyles: { fillColor: [79, 129, 189], textColor: [255, 255, 255] },
      styles: { fontSize: 8 },
      margin: { top: 30, left: 10, right: 10 },
    });

    doc.save(fileName);
    return true;
  } catch (error) {
    console.error("Error exporting informe to PDF:", sanitizeForLog(error.message));
    return false;
  }
};
import { DOMParser, Element } from "npm:linkedom@0.15.0";
import { saveProduct } from "./crud.ts"

interface Product {
  name: string;
  code: string;
  quantity: number;
  unit: string;
  totalValue: number;
  purchaseDate: Date;
  sellerName: string;
  publicId: string;
}

interface NoteGeneralInfo {
  emitente: {
    nomeRazaoSocial: string;
    cnpj: string;
    inscricaoEstadual: string;
    uf: string;
  };
  operacao: {
    destinoOperacao: string;
    consumidorFinal: string;
    presencaComprador: string;
  };
  nota: {
    modelo: string;
    serie: string;
    numero: string;
    dataEmissao: string;
  };
  valores: {
    valorTotalServico: string;
    baseCalculoICMS: string;
    valorICMS: string;
  };
  protocolo: string;
}

interface ParseResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

function extractCollapse4DataFromHTML(html: string): ParseResult<NoteGeneralInfo> {
  try {
    if (!html || html.trim().length === 0) {
      return {
        success: false,
        error: "HTML content is empty or invalid",
      };
    }
    const document = new DOMParser().parseFromString(html, "text/html");
    const collapse4 = document.querySelector("#collapse4");
    if (!collapse4) {
      return {
        success: false,
        error: "Element #collapse4 not found in HTML. The receipt structure may have changed or the HTML is invalid.",
      };
    }
    const tables = collapse4.querySelectorAll("table");
    const expectedTableCount = 5;
    if (tables.length < expectedTableCount) {
      return {
        success: false,
        error: `Expected ${expectedTableCount} tables in #collapse4, but found ${tables.length}. The receipt structure may be incomplete.`,
      };
    }
    const emitenteResult = extractEmitenteData(tables[0]);
    if (!emitenteResult.success) {
      return {
        success: false,
        error: `Failed to extract emitente data: ${emitenteResult.error}`,
      };
    }
    const operacaoResult = extractOperacaoData(tables[1]);
    if (!operacaoResult.success) {
      return {
        success: false,
        error: `Failed to extract operacao data: ${operacaoResult.error}`,
      };
    }
    const notaResult = extractNotaData(tables[2]);
    if (!notaResult.success) {
      return {
        success: false,
        error: `Failed to extract nota data: ${notaResult.error}`,
      };
    }
    const valoresResult = extractValoresData(tables[3]);
    if (!valoresResult.success) {
      return {
        success: false,
        error: `Failed to extract valores data: ${valoresResult.error}`,
      };
    }
    const protocoloResult = extractProtocoloData(tables[4]);
    if (!protocoloResult.success) {
      return {
        success: false,
        error: `Failed to extract protocolo data: ${protocoloResult.error}`,
      };
    }
    return {
      success: true,
      data: {
        emitente: emitenteResult.data!,
        operacao: operacaoResult.data!,
        nota: notaResult.data!,
        valores: valoresResult.data!,
        protocolo: protocoloResult.data!,
      },
    };
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error while parsing collapse4 data: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

function getCellText(cell: Element | null): string {
  if (!cell) return "";
  const div = cell.querySelector("div");
  return (div?.textContent || cell.textContent || "").trim();
}

function getRowCells(table: Element | undefined, rowIndex: number = 0, tableName: string = "table"): ParseResult<Element[]> {
  if (!table) {
    return {
      success: false,
      error: `${tableName} element is undefined or null`,
    };
  }
  const rows = table.querySelectorAll("tbody tr");
  if (rows.length === 0) {
    return {
      success: false,
      error: `${tableName} has no tbody rows`,
    };
  }
  if (rows.length <= rowIndex) {
    return {
      success: false,
      error: `${tableName} has only ${rows.length} row(s), but row index ${rowIndex} was requested`,
    };
  }
  const cells = Array.from(rows[rowIndex].querySelectorAll("td")) as Element[];
  if (cells.length === 0) {
    return {
      success: false,
      error: `${tableName} row ${rowIndex} has no cells (td elements)`,
    };
  }
  return {
    success: true,
    data: cells,
  };
}

function extractEmitenteData(table: Element | undefined): ParseResult<NoteGeneralInfo["emitente"]> {
  const cellsResult = getRowCells(table, 0, "Emitente table");
  if (!cellsResult.success || !cellsResult.data) {
    return {
      success: false,
      error: cellsResult.error || "Failed to get emitente table cells",
    };
  }
  const cells = cellsResult.data;
  const expectedCellCount = 4;
  if (cells.length < expectedCellCount) {
    return {
      success: false,
      error: `Emitente table has ${cells.length} cells, but expected ${expectedCellCount} (nomeRazaoSocial, cnpj, inscricaoEstadual, uf)`,
    };
  }
  return {
    success: true,
    data: {
      nomeRazaoSocial: getCellText(cells[0]),
      cnpj: getCellText(cells[1]),
      inscricaoEstadual: getCellText(cells[2]),
      uf: getCellText(cells[3]),
    },
  };
}

function extractOperacaoData(table: Element | undefined): ParseResult<NoteGeneralInfo["operacao"]> {
  const cellsResult = getRowCells(table, 0, "Operacao table");
  if (!cellsResult.success || !cellsResult.data) {
    return {
      success: false,
      error: cellsResult.error || "Failed to get operacao table cells",
    };
  }
  const cells = cellsResult.data;
  const expectedCellCount = 3;
  if (cells.length < expectedCellCount) {
    return {
      success: false,
      error: `Operacao table has ${cells.length} cells, but expected ${expectedCellCount} (destinoOperacao, consumidorFinal, presencaComprador)`,
    };
  }
  return {
    success: true,
    data: {
      destinoOperacao: getCellText(cells[0]),
      consumidorFinal: getCellText(cells[1]),
      presencaComprador: getCellText(cells[2]),
    },
  };
}

function extractNotaData(table: Element | undefined): ParseResult<NoteGeneralInfo["nota"]> {
  const cellsResult = getRowCells(table, 0, "Nota table");
  if (!cellsResult.success || !cellsResult.data) {
    return {
      success: false,
      error: cellsResult.error || "Failed to get nota table cells",
    };
  }
  const cells = cellsResult.data;
  const expectedCellCount = 4;
  if (cells.length < expectedCellCount) {
    return {
      success: false,
      error: `Nota table has ${cells.length} cells, but expected ${expectedCellCount} (modelo, serie, numero, dataEmissao)`,
    };
  }
  return {
    success: true,
    data: {
      modelo: getCellText(cells[0]),
      serie: getCellText(cells[1]),
      numero: getCellText(cells[2]),
      dataEmissao: getCellText(cells[3]),
    },
  };
}

function extractValoresData(table: Element | undefined): ParseResult<NoteGeneralInfo["valores"]> {
  const cellsResult = getRowCells(table, 0, "Valores table");
  if (!cellsResult.success || !cellsResult.data) {
    return {
      success: false,
      error: cellsResult.error || "Failed to get valores table cells",
    };
  }
  const cells = cellsResult.data;
  const expectedCellCount = 3;
  if (cells.length < expectedCellCount) {
    return {
      success: false,
      error: `Valores table has ${cells.length} cells, but expected ${expectedCellCount} (valorTotalServico, baseCalculoICMS, valorICMS)`,
    };
  }
  return {
    success: true,
    data: {
      valorTotalServico: getCellText(cells[0]),
      baseCalculoICMS: getCellText(cells[1]),
      valorICMS: getCellText(cells[2]),
    },
  };
}

function extractProtocoloData(table: Element | undefined): ParseResult<string> {
  const cellsResult = getRowCells(table, 0, "Protocolo table");
  if (!cellsResult.success || !cellsResult.data) {
    return {
      success: false,
      error: cellsResult.error || "Failed to get protocolo table cells",
    };
  }
  const cells = cellsResult.data;
  if (cells.length === 0) {
    return {
      success: false,
      error: "Protocolo table has no cells",
    };
  }
  const protocolo = getCellText(cells[0]);
  if (!protocolo) {
    return {
      success: false,
      error: "Protocolo cell is empty",
    };
  }
  return {
    success: true,
    data: protocolo,
  };
}

function parseProductsFromHtml(
  html: string,
  seller: string,
  purchaseDate: string,
  protocolo: string
): ParseResult<Product[]> {
  try {
    if (!html || html.trim().length === 0) {
      return {
        success: false,
        error: "HTML content is empty or invalid",
      };
    }
    if (!seller || seller.trim().length === 0) {
      return {
        success: false,
        error: "Seller name is required",
      };
    }
    if (!purchaseDate || purchaseDate.trim().length === 0) {
      return {
        success: false,
        error: "Purchase date is required",
      };
    }
    const doc = new DOMParser().parseFromString(html, "text/html");
    const tbody = doc.querySelector("#myTable");
    if (!tbody) {
      return {
        success: false,
        error: "Element #myTable not found in HTML. The products table may be missing or the HTML structure has changed.",
      };
    }
    const rows = Array.from(tbody.querySelectorAll("tr"));
    if (rows.length === 0) {
      return {
        success: false,
        error: "No product rows found in #myTable. The receipt may not contain any products.",
      };
    }
    const products: Product[] = [];
    const errors: string[] = [];
    let parsedDate: Date;
    try {
      parsedDate = new Date(
        purchaseDate.replace(/(\d{2})\/(\d{2})\/(\d{4}) (\d{2}:\d{2}:\d{2})/, "$3-$2-$1T$4")
      );
      if (isNaN(parsedDate.getTime())) {
        return {
          success: false,
          error: `Invalid purchase date format: ${purchaseDate}. Expected format: DD/MM/YYYY HH:mm:ss`,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to parse purchase date: ${purchaseDate}. Error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
    rows.forEach((row: Element, index: number) => {
      const cells = row.querySelectorAll("td");
      if (cells.length !== 4) {
        errors.push(`Row ${index + 1}: Expected 4 cells, but found ${cells.length}`);
        return;
      }
      const firstCell = cells[0];
      if (!firstCell) {
        errors.push(`Row ${index + 1}: First cell is missing`);
        return;
      }
      const h7 = firstCell.querySelector("h7");
      const name = h7 ? (h7.textContent || "").trim() : (firstCell.textContent || "").trim();
      if (!name) {
        errors.push(`Row ${index + 1}: Product name is empty`);
      }
      const codeMatch = (firstCell.textContent || "").match(/\(Código:\s*(\d+)\)/);
      const code = codeMatch ? codeMatch[1] : "";
      if (!code) {
        errors.push(`Row ${index + 1}: Product code not found in expected format (Código: number)`);
      }
      const quantityText = (cells[1]?.textContent || "").trim();
      const quantityMatch = quantityText.match(/Qtde total de ítens:\s*([\d.,]+)/);
      if (!quantityMatch) {
        errors.push(`Row ${index + 1}: Quantity not found in expected format. Cell content: "${quantityText}"`);
      }
      const quantity = quantityMatch ? parseFloat(quantityMatch[1].replace(",", ".")) : 0;
      if (isNaN(quantity)) {
        errors.push(`Row ${index + 1}: Invalid quantity value: ${quantityMatch?.[1]}`);
      }
      const unitText = (cells[2]?.textContent || "").trim();
      const unitMatch = unitText.match(/UN:\s*(.+)/);
      if (!unitMatch) {
        errors.push(`Row ${index + 1}: Unit not found in expected format. Cell content: "${unitText}"`);
      }
      const unit = unitMatch ? unitMatch[1].trim() : "";
      const valueText = (cells[3]?.textContent || "").trim();
      const valueMatch = valueText.match(/Valor total R\$:\s*R\$\s*([\d.,]+)/);
      if (!valueMatch) {
        errors.push(`Row ${index + 1}: Value not found in expected format. Cell content: "${valueText}"`);
      }
      let totalValue = 0;
      if (valueMatch) {
        const valueString = valueMatch[1].replace(/\./g, "").replace(",", ".");
        totalValue = parseFloat(valueString) || 0;
        if (isNaN(totalValue)) {
          errors.push(`Row ${index + 1}: Invalid total value: ${valueMatch[1]}`);
        }
      }
      products.push({
        name,
        code,
        quantity,
        unit,
        totalValue,
        purchaseDate: parsedDate,
        sellerName: seller,
        publicId: `${protocolo}-${code}`,
      });
    });
    if (products.length === 0 && errors.length > 0) {
      return {
        success: false,
        error: `Failed to parse any products. Errors: ${errors.join("; ")}`,
      };
    }
    if (errors.length > 0 && products.length > 0) {
      return {
        success: true,
        data: products,
        error: `Some products had parsing issues: ${errors.join("; ")}`,
      };
    }
    return {
      success: true,
      data: products,
    };
  } catch (error) {
    return {
      success: false,
      error: `Unexpected error while parsing products: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Response helpers
const corsHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Authorization, Content-Type",
};

function createResponse(
  data: unknown,
  status: number = 200,
  headers: Record<string, string> = corsHeaders
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, ...headers },
  });
}

function createErrorResponse(
  message: string,
  status: number = 500,
  additionalData: Record<string, unknown> = {}
): Response {
  return createResponse(
    { message, ...additionalData },
    status
  );
}

function createSuccessResponse(data: unknown): Response {
  return createResponse(data, 200);
}

// Request validation
interface RequestBody {
  url?: string;
}

function validateUrl(body: RequestBody): string | null {
  if (!body.url || typeof body.url !== "string" || body.url.trim().length === 0) {
    return null;
  }
  return body.url;
}

// Fetch helpers
async function fetchReceiptHtml(url: string): Promise<ParseResult<string>> {
  try {
    const response = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; Supabase-Edge-Function/1.0)" },
    });
    if (!response.ok) {
      return {
        success: false,
        error: `Failed to fetch URL: HTTP ${response.status} ${response.statusText}`,
      };
    }
    const htmlText = await response.text();
    if (!htmlText || htmlText.trim().length === 0) {
      return {
        success: false,
        error: "Received empty HTML response",
      };
    }
    return {
      success: true,
      data: htmlText,
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to fetch URL: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

// Processing logic
interface ProcessReceiptResult {
  products: Product[];
  noteGeneralInfo: NoteGeneralInfo;
  warnings?: string[];
}

async function processReceipt(htmlText: string): Promise<ParseResult<ProcessReceiptResult>> {
  const noteGeneralInfoResult = extractCollapse4DataFromHTML(htmlText);
  if (!noteGeneralInfoResult.success || !noteGeneralInfoResult.data) {
    return {
      success: false,
      error: `Failed to parse note general info: ${noteGeneralInfoResult.error}`,
    };
  }
  const noteGeneralInfo = noteGeneralInfoResult.data;
  const seller = noteGeneralInfo.emitente.nomeRazaoSocial;
  const purchaseDate = noteGeneralInfo.nota.dataEmissao;
  const protocolo = noteGeneralInfo.protocolo;
  const productsResult = parseProductsFromHtml(htmlText, seller, purchaseDate, protocolo);
  if (!productsResult.success) {
    return {
      success: false,
      error: `Failed to parse products: ${productsResult.error}`,
      data: productsResult.data ? {
        products: productsResult.data,
        noteGeneralInfo,
        warnings: [productsResult.error || "Partial parsing completed with errors"],
      } : undefined,
    };
  }
  if (!productsResult.data) {
    return {
      success: false,
      error: "Products parsed successfully but no data returned",
    };
  }
  const warnings: string[] = [];
  if (productsResult.error) {
    warnings.push(productsResult.error);
  }
  return {
    success: true,
    data: {
      products: productsResult.data,
      noteGeneralInfo,
      warnings: warnings.length > 0 ? warnings : undefined,
    },
  };
}

// Product conversion (Product has Date, but DB needs string)
function convertProductsForDb(products: Product[]): Array<Omit<Product, "purchaseDate"> & { purchaseDate: string }> {
  return products.map((product) => ({
    ...product,
    purchaseDate: product.purchaseDate.toISOString(),
  }));
}

// Main handler
async function handleReceiptRequest(req: Request): Promise<Response> {
  // Handle preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }
  // Validate request body
  const body = await req.json();
  const url = validateUrl(body);
  if (!url) {
    return createErrorResponse(
      "Did not receive a valid URL",
      400,
      { count: 0, products: [] }
    );
  }
  // Fetch HTML
  const htmlResult = await fetchReceiptHtml(url);
  if (!htmlResult.success || !htmlResult.data) {
    return createErrorResponse(
      htmlResult.error || "Failed to fetch receipt HTML",
      502,
      { count: 0, products: [] }
    );
  }
  // Process receipt
  const processResult = await processReceipt(htmlResult.data);
  if (!processResult.success) {
    // Return partial results if available
    if (processResult.data) {
      const productsForDb = convertProductsForDb(processResult.data.products);
      try {
        await saveProduct(req.headers.get("Authorization") || "", productsForDb);
      } catch (error) {
        console.error("Failed to save products:", error);
      }
      return createSuccessResponse({
        count: processResult.data.products.length,
        products: processResult.data.products,
        warnings: processResult.data.warnings,
        noteGeneralInfo: processResult.data.noteGeneralInfo,
      });
    }
    return createErrorResponse(
      processResult.error || "Failed to process receipt",
      502,
      { count: 0, products: [] }
    );
  }
  if (!processResult.data) {
    return createErrorResponse(
      "Processing completed but no data returned",
      502,
      { count: 0, products: [] }
    );
  }
  // Save products to database
  const productsForDb = convertProductsForDb(processResult.data.products);
  try {
    await saveProduct(req.headers.get("Authorization") || "", productsForDb);
  } catch (error) {
    console.error("Failed to save products:", error);
    return createErrorResponse(
      `Failed to save products: ${error instanceof Error ? error.message : String(error)}`,
      500,
      {
        count: processResult.data.products.length,
        products: processResult.data.products,
        noteGeneralInfo: processResult.data.noteGeneralInfo,
      }
    );
  }
  // Return success response
  return createSuccessResponse({
    count: processResult.data.products.length,
    products: processResult.data.products,
    noteGeneralInfo: processResult.data.noteGeneralInfo,
    warnings: processResult.data.warnings,
  });
}

// Deno serve
Deno.serve(async (req: Request) => {
  try {
    return await handleReceiptRequest(req);
  } catch (error) {
    console.error("Unexpected error:", error);
    return createErrorResponse(
      `Unexpected error: ${error instanceof Error ? error.message : String(error)}`,
      500
    );
  }
});
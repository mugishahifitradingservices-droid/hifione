import * as XLSX from 'xlsx';

export interface ExcelOrgRow {
  name: string;
  type_of_business?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
}

export const downloadOrganizationTemplate = () => {
  const templateData = [
    {
      "Organization Name": "HIFI Trading Kenya Ltd",
      "Type of Business": "Distributor",
      "Phone": "+254 700 123456",
      "Email": "info@hifitrading.co.ke",
      "Website": "https://hifitrading.co.ke",
      "Address": "123 Enterprise Road, Industrial Area, Nairobi"
    },
    {
      "Organization Name": "Apex Medical Supplies",
      "Type of Business": "Healthcare Partner",
      "Phone": "+254 722 987654",
      "Email": "procurement@apexmed.com",
      "Website": "https://apexmed.com",
      "Address": "45 Hospital Ridge, Upper Hill, Nairobi"
    }
  ];

  const worksheet = XLSX.utils.json_to_sheet(templateData);
  
  // Custom column widths
  worksheet['!cols'] = [
    { wch: 28 },
    { wch: 22 },
    { wch: 18 },
    { wch: 25 },
    { wch: 25 },
    { wch: 40 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Organizations");
  XLSX.writeFile(workbook, "HIFI_ONE_Organizations_Template.xlsx");
};

export const exportOrganizationsToExcel = (orgs: any[], filename = "HIFI_ONE_Organizations_Export.xlsx") => {
  const exportData = orgs.map(org => ({
    "Organization Name": org.name || '',
    "Type of Business": org.type_of_business || 'General Business',
    "Phone": org.phone || '',
    "Email": org.email || '',
    "Website": org.website || '',
    "Address": org.address || '',
    "Total Contacts": org.contactsCount ?? (org.contacts?.length || 0),
    "Total Visits": org.visitsCount ?? (org.visits?.length || 0),
    "Created Date": org.created_at ? new Date(org.created_at).toLocaleDateString() : ''
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  worksheet['!cols'] = [
    { wch: 30 },
    { wch: 24 },
    { wch: 18 },
    { wch: 26 },
    { wch: 26 },
    { wch: 36 },
    { wch: 16 },
    { wch: 14 },
    { wch: 16 }
  ];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, "Organizations");
  XLSX.writeFile(workbook, filename);
};

export const parseExcelFile = (file: File): Promise<ExcelOrgRow[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });

        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          throw new Error('Excel file contains no readable worksheets.');
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson: Record<string, any>[] = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

        const parsedRows: ExcelOrgRow[] = [];

        for (const row of rawJson) {
          // Normalize keys for robust mapping
          const normalizedKeys = Object.keys(row).reduce((acc, key) => {
            acc[key.trim().toLowerCase()] = row[key];
            return acc;
          }, {} as Record<string, any>);

          const findVal = (possibleKeys: string[]): string => {
            for (const key of possibleKeys) {
              if (normalizedKeys[key] !== undefined && normalizedKeys[key] !== '') {
                return String(normalizedKeys[key]).trim();
              }
            }
            return '';
          };

          const name = findVal(['organization name', 'name', 'organization', 'company name', 'org name', 'company', 'organization_name']);
          const type_of_business = findVal(['type of business', 'type', 'business type', 'industry', 'category', 'type_of_business']);
          const phone = findVal(['phone', 'phone number', 'contact number', 'tel', 'telephone', 'mobile']);
          const email = findVal(['email', 'email address', 'mail', 'e-mail']);
          const website = findVal(['website', 'web', 'url', 'site']);
          const address = findVal(['address', 'location', 'physical address', 'street']);

          if (name) {
            parsedRows.push({
              name,
              type_of_business,
              phone,
              email,
              website,
              address
            });
          }
        }

        resolve(parsedRows);
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsArrayBuffer(file);
  });
};

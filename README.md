# Salesforce Report Metadata Retrieval

A Node.js script for bulk retrieval of Salesforce report metadata. This tool helps you understand the structure, fields, and filters of all reports in your organization.

## Features

- Automatic retrieval of all report metadata, including report saved in private folders
- Query configuration through environment variables
- Detailed report metadata storage
- Real-time progress and timing statistics

## Prerequisites

- Node.js 12.0 or higher
- Salesforce account with API access
- Salesforce security token

## Installation

1. Clone the repository:
```bash
git clone [repository-url]
cd salesforce-report-metadata-retrieval
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Fill in the following configuration:
```env
# Salesforce Connection Settings
SF_LOGIN_URL=https://login.salesforce.com
SF_USERNAME=your_username
SF_PASSWORD=your_password
SF_SECURITY_TOKEN=your_security_token

# Report Query Configuration
SF_REPORT_LAST_RUN_DATE=2024-12-01T00:00:01.000+08:00  # Optional, filter by last run date
```

## Usage

Run the script:
```bash
npm start
```

## Output

The script generates the following files in the `report_metadata` directory:

1. Individual report metadata (JSON format):
```json
{
    "basicInfo": {
        "id": "00OB0000000XXXXX",
        "name": "Report Name",
        "folderName": "Folder Name",
        "reportType": "Report Type"
    },
    "fields": {
        "detailColumns": ["Field1", "Field2"],
        "groupingsDown": ["Grouping Field"],
        "groupingsAcross": []
    },
    "filters": {
        "standardFilters": ["Standard Filter"],
        "crossFilters": ["Cross Filter"],
        "scopeFilters": [],
        "historicalFilters": []
    },
    "additionalInfo": {
        "currency": "Currency",
        "showGrandTotal": true,
        "showSubtotals": true,
        "lastRunDate": "2024-03-26T00:00:00.000Z"
    }
}
```

2. Summary file `reports_summary.json`:
```json
{
    "totalReports": 100,
    "processedAt": "2024-03-26T10:30:00.000Z",
    "queryConfig": {
        "lastRunDate": "2024-12-01T00:00:01.000+08:00"
    },
    "reports": [
        // Array of all report metadata
    ]
}
```

## Important Notes

- Keep sensitive information in `.env` file secure and do not commit it to version control
- Processing may take considerable time for organizations with many reports
- The `report_metadata` directory is cleared before each run
- All errors and exceptions are logged in both console and summary file

## Error Handling

- Connection errors: Verify Salesforce authentication information
- API errors: Ensure user has sufficient permissions to access reports
- Processing errors: Individual report failures won't affect the processing of other reports

## Contributing

Issues and Pull Requests are welcome to improve this tool.
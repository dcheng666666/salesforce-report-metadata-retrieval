import dotenv from 'dotenv';
import jsforce from 'jsforce';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Initialize environment variables
dotenv.config();

// Get directory name in ES modules
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize Salesforce connection
const conn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL
});

// Load configuration from environment variables
function loadConfigFromEnv() {
    const config = {};

    if (process.env.SF_REPORT_LAST_RUN_DATE) {
        config.lastRunDate = process.env.SF_REPORT_LAST_RUN_DATE;
    }

    return config;
}

// Function to format report metadata
function formatReportMetadata(report, reportMetadata) {
    return {
        basicInfo: {
            id: report.Id,
            name: report.Name,
            folderName: report.FolderName,
            reportType: reportMetadata.reportMetadata.reportType.label
        },
        fields: {
            detailColumns: reportMetadata.reportMetadata.detailColumns || [],
            groupingsDown: reportMetadata.reportMetadata.groupingsDown || [],
            groupingsAcross: reportMetadata.reportMetadata.groupingsAcross || []
        },
        filters: {
            standardFilters: reportMetadata.reportMetadata.reportFilters || [],
            crossFilters: reportMetadata.reportMetadata.crossFilters || [],
            scopeFilters: reportMetadata.reportMetadata.scopeFilters || [],
            historicalFilters: reportMetadata.reportMetadata.historicalSnapshotDates || []
        },
        additionalInfo: {
            currency: reportMetadata.reportMetadata.currency,
            showGrandTotal: reportMetadata.reportMetadata.showGrandTotal,
            showSubtotals: reportMetadata.reportMetadata.showSubtotals,
            lastRunDate: report.LastRunDate
        }
    };
}

// Function to format time duration
function formatDuration(startTime) {
    const duration = Date.now() - startTime;
    if (duration < 1000) {
        return `${duration}ms`;
    } else {
        return `${(duration / 1000).toFixed(2)}s`;
    }
}

// Function to clean up existing results
function cleanupExistingResults(outputDir) {
    if (fs.existsSync(outputDir)) {
        console.log('Cleaning up existing results...');
        const files = fs.readdirSync(outputDir);
        for (const file of files) {
            fs.unlinkSync(path.join(outputDir, file));
        }
        fs.rmdirSync(outputDir);
        console.log('Cleanup complete.');
    }
}

// Function to build SOQL query from config
function buildQueryFromConfig(config = {}) {
    let query = 'SELECT Id, Name, FolderName, LastRunDate FROM Report';
    const conditions = [];

    if (config.lastRunDate) {
        conditions.push(`LastRunDate > ${config.lastRunDate}`);
    }

    if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
    }

    return query;
}

// Function to fetch all reports using queryMore
async function getAllReports(config = {}) {
    let allRecords = [];
    const query = buildQueryFromConfig(config);
    let result = await conn.query(query);

    // Add records from first query
    allRecords = allRecords.concat(result.records);

    // Continue querying if there are more records
    while (!result.done) {
        result = await conn.queryMore(result.nextRecordsUrl);
        allRecords = allRecords.concat(result.records);
        console.log(`Fetched ${allRecords.length} reports so far...`);
    }

    return {
        records: allRecords,
        totalSize: allRecords.length,
        query: query // Add query to result for debugging
    };
}

// Function to setup Salesforce connection
async function setupSalesforceConnection() {
    await conn.login(process.env.SF_USERNAME, process.env.SF_PASSWORD + process.env.SF_SECURITY_TOKEN);
    console.log('Connected to Salesforce successfully!');
}

// Function to setup output directory
function setupOutputDirectory(outputDir) {
    cleanupExistingResults(outputDir);
    fs.mkdirSync(outputDir);
    return path.join(outputDir, 'reports_summary.json');
}

// Function to fetch single report metadata
async function fetchReportMetadata(report) {
    return await conn.request({
        method: 'GET',
        url: `/services/data/v62.0/analytics/reports/${report.Id}/describe`
    });
}

// Function to save individual report metadata
function saveReportMetadata(outputDir, report, metadata) {
    const reportFileName = `${report.Name.replace(/[^a-z0-9]/gi, '_')}.json`;
    fs.writeFileSync(
        path.join(outputDir, reportFileName),
        JSON.stringify(metadata, null, 2)
    );
}

// Function to process single report
async function processReport(report, index, totalReports, outputDir) {
    const startTime = Date.now();
    try {
        const reportMetadata = await fetchReportMetadata(report);
        const formattedMetadata = formatReportMetadata(report, reportMetadata);

        saveReportMetadata(outputDir, report, formattedMetadata);

        console.log(`✓ Processed: ${report.Name} (${index + 1}/${totalReports}) - Time: ${formatDuration(startTime)}`);
        return formattedMetadata;
    } catch (error) {
        console.error(`Error processing report ${report.Name} (${index + 1}/${totalReports}) - Time: ${formatDuration(startTime)}:`, error.message);
        return {
            error: true,
            reportName: report.Name,
            errorMessage: error.message
        };
    }
}

// Function to save summary file
function saveSummaryFile(summaryFile, totalReports, allReportsMetadata, queryConfig) {
    const summary = {
        totalReports: totalReports,
        processedAt: new Date().toISOString(),
        queryConfig: queryConfig, // Add query configuration to summary file
        reports: allReportsMetadata
    };
    fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
    console.log('\nProcessing complete!');
    console.log(`Summary file saved to: ${summaryFile}`);
}

// Main function to process all reports
async function getAllReportsMetadata() {
    try {
        // Load config from environment variables
        const config = loadConfigFromEnv();

        // Setup connection and directory
        await setupSalesforceConnection();
        const outputDir = 'report_metadata';
        const summaryFile = setupOutputDirectory(outputDir);

        // Fetch all reports
        console.log('Fetching all reports...');
        console.log('Using configuration:', config);
        const reports = await getAllReports(config);
        console.log(`Found ${reports.totalSize} reports in total`);
        console.log(`Using query: ${reports.query}`);

        // Process all reports
        const allReportsMetadata = [];
        for (let i = 0; i < reports.records.length; i++) {
            const metadata = await processReport(reports.records[i], i, reports.records.length, outputDir);
            allReportsMetadata.push(metadata);
        }

        // Save summary
        saveSummaryFile(summaryFile, reports.totalSize, allReportsMetadata, config);

    } catch (error) {
        console.error('Error:', error.message);
    } finally {
        await conn.logout();
        console.log('\nLogged out of Salesforce');
    }
}

// Call main function with configuration from environment variables
getAllReportsMetadata();
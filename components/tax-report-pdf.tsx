'use client';

import React, { useRef, useState } from 'react';
import { Button } from './ui/button';
import { DownloadIcon, FileTextIcon } from 'lucide-react';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement, Title } from 'chart.js';
import { Pie, Bar } from 'react-chartjs-2';

// Register ChartJS components
ChartJS.register(ArcElement, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface TaxReportPDFProps {
  analysisData: {
    content: string;
  };
  documentName: string;
}

export function TaxReportPDF({ analysisData, documentName }: TaxReportPDFProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);
  
  // Extract financial data from the analysis
  const extractFinancialData = () => {
    const content = analysisData.content;
    
    // Extract revenue
    const revenueMatch = content.match(/Total revenue:?\s*(AED)?\s*([\d,]+)/i);
    const revenue = revenueMatch ? parseFloat(revenueMatch[2].replace(/,/g, '')) : 0;
    
    // Extract expenses
    const expensesMatch = content.match(/Total expenses:?\s*(AED)?\s*([\d,]+)/i);
    const expenses = expensesMatch ? parseFloat(expensesMatch[2].replace(/,/g, '')) : 0;
    
    // Extract net income
    const netIncomeMatch = content.match(/Net (income|profit|loss):?\s*(AED)?\s*([\d,]+)/i);
    const netIncome = netIncomeMatch ? parseFloat(netIncomeMatch[3].replace(/,/g, '')) : 0;
    
    // Extract assets
    const assetsMatch = content.match(/Total assets:?\s*(AED)?\s*([\d,]+)/i);
    const assets = assetsMatch ? parseFloat(assetsMatch[2].replace(/,/g, '')) : 0;
    
    // Extract liabilities
    const liabilitiesMatch = content.match(/Total liabilities:?\s*(AED)?\s*([\d,]+)/i);
    const liabilities = liabilitiesMatch ? parseFloat(liabilitiesMatch[2].replace(/,/g, '')) : 0;
    
    // Extract tax estimate
    const taxMatch = content.match(/tax (liability|estimate|obligation):?\s*(AED)?\s*([\d,]+)/i);
    const taxEstimate = taxMatch ? parseFloat(taxMatch[3].replace(/,/g, '')) : 0;
    
    return {
      revenue,
      expenses,
      netIncome,
      assets,
      liabilities,
      taxEstimate
    };
  };
  
  // Extract recommendations from the analysis
  const extractRecommendations = () => {
    const content = analysisData.content;
    
    // Look for recommendations section
    const recommendationsSection = content.match(/Recommendations:([^#]*)/i) || 
                                  content.match(/Analysis and Recommendations:([^#]*)/i);
    
    if (recommendationsSection && recommendationsSection[1]) {
      // Split by bullet points or numbered items
      const recommendations = recommendationsSection[1]
        .split(/\n\s*[-•*]\s*|\n\s*\d+\.\s*/)
        .filter(item => item.trim().length > 10) // Filter out empty or very short items
        .map(item => item.trim())
        .slice(0, 5); // Get top 5 recommendations
      
      return recommendations;
    }
    
    return [];
  };
  
  // Extract executive summary
  const extractExecutiveSummary = () => {
    const content = analysisData.content;
    
    // Look for executive summary section
    const summarySection = content.match(/Executive Summary:([^#]*)/i);
    
    if (summarySection && summarySection[1]) {
      return summarySection[1].trim();
    }
    
    return "No executive summary found.";
  };
  
  // Generate PDF report
  const generatePDF = async () => {
    setIsGenerating(true);
    
    try {
      const financialData = extractFinancialData();
      const recommendations = extractRecommendations();
      const executiveSummary = extractExecutiveSummary();
      
      // Create new PDF document
      const doc = new jsPDF();
      
      // Add title
      doc.setFontSize(20);
      doc.setTextColor(0, 51, 102);
      doc.text("MusTax AI Tax Analysis Report", 105, 20, { align: 'center' });
      
      // Add document name
      doc.setFontSize(12);
      doc.setTextColor(0, 0, 0);
      doc.text(`Document: ${documentName}`, 105, 30, { align: 'center' });
      
      // Add date
      const today = new Date();
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(`Generated on: ${today.toLocaleDateString()}`, 105, 35, { align: 'center' });
      
      // Add executive summary
      doc.setFontSize(14);
      doc.setTextColor(0, 51, 102);
      doc.text("Executive Summary", 14, 45);
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const summaryLines = doc.splitTextToSize(executiveSummary, 180);
      doc.text(summaryLines, 14, 55);
      
      // Add financial data table
      doc.setFontSize(14);
      doc.setTextColor(0, 51, 102);
      doc.text("Financial Overview", 14, 90);
      
      // @ts-ignore - jspdf-autotable types
      doc.autoTable({
        startY: 95,
        head: [['Metric', 'Amount (AED)']],
        body: [
          ['Total Revenue', financialData.revenue.toLocaleString()],
          ['Total Expenses', financialData.expenses.toLocaleString()],
          ['Net Income', financialData.netIncome.toLocaleString()],
          ['Total Assets', financialData.assets.toLocaleString()],
          ['Total Liabilities', financialData.liabilities.toLocaleString()],
          ['Estimated Tax Liability', financialData.taxEstimate.toLocaleString()]
        ],
        theme: 'grid',
        headStyles: { fillColor: [0, 51, 102], textColor: [255, 255, 255] },
        alternateRowStyles: { fillColor: [240, 240, 240] }
      });
      
      // Add recommendations
      doc.setFontSize(14);
      doc.setTextColor(0, 51, 102);
      doc.text("Key Recommendations", 14, 150);
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      let yPos = 160;
      
      recommendations.forEach((recommendation, index) => {
        const recLines = doc.splitTextToSize(`${index + 1}. ${recommendation}`, 180);
        doc.text(recLines, 14, yPos);
        yPos += 10 + (recLines.length - 1) * 5;
        
        // Add a new page if we're running out of space
        if (yPos > 270) {
          doc.addPage();
          yPos = 20;
        }
      });
      
      // Add a new page for charts
      doc.addPage();
      
      // Add title for charts page
      doc.setFontSize(14);
      doc.setTextColor(0, 51, 102);
      doc.text("Financial Visualization", 105, 20, { align: 'center' });
      
      // Create canvas for charts
      const canvas = document.createElement('canvas');
      canvas.width = 500;
      canvas.height = 300;
      document.body.appendChild(canvas);
      
      // Create expense vs revenue chart
      const barChart = new ChartJS(canvas, {
        type: 'bar',
        data: {
          labels: ['Revenue', 'Expenses', 'Net Income'],
          datasets: [{
            label: 'Financial Overview (AED)',
            data: [financialData.revenue, financialData.expenses, financialData.netIncome],
            backgroundColor: [
              'rgba(54, 162, 235, 0.6)',
              'rgba(255, 99, 132, 0.6)',
              'rgba(75, 192, 192, 0.6)'
            ],
            borderColor: [
              'rgba(54, 162, 235, 1)',
              'rgba(255, 99, 132, 1)',
              'rgba(75, 192, 192, 1)'
            ],
            borderWidth: 1
          }]
        },
        options: {
          scales: {
            y: {
              beginAtZero: true
            }
          }
        }
      });
      
      // Add bar chart to PDF
      const barChartImg = canvas.toDataURL('image/png');
      doc.addImage(barChartImg, 'PNG', 20, 30, 170, 100);
      
      // Create assets vs liabilities pie chart
      const pieChart = new ChartJS(canvas, {
        type: 'pie',
        data: {
          labels: ['Assets', 'Liabilities'],
          datasets: [{
            data: [financialData.assets, financialData.liabilities],
            backgroundColor: [
              'rgba(54, 162, 235, 0.6)',
              'rgba(255, 99, 132, 0.6)'
            ],
            borderColor: [
              'rgba(54, 162, 235, 1)',
              'rgba(255, 99, 132, 1)'
            ],
            borderWidth: 1
          }]
        }
      });
      
      // Add pie chart to PDF
      const pieChartImg = canvas.toDataURL('image/png');
      doc.addImage(pieChartImg, 'PNG', 50, 150, 110, 110);
      
      // Add disclaimer
      doc.addPage();
      doc.setFontSize(14);
      doc.setTextColor(0, 51, 102);
      doc.text("Disclaimer", 105, 20, { align: 'center' });
      
      doc.setFontSize(10);
      doc.setTextColor(0, 0, 0);
      const disclaimer = "This report is generated based on AI analysis of the provided document and is for informational purposes only. The financial data, analysis, and recommendations should be verified by a qualified tax professional before making any financial or tax-related decisions.";
      const disclaimerLines = doc.splitTextToSize(disclaimer, 180);
      doc.text(disclaimerLines, 14, 30);
      
      // Save the PDF
      const fileName = `${documentName.replace(/\.[^/.]+$/, '')}_Tax_Analysis.pdf`;
      doc.save(fileName);
      
      // Clean up
      document.body.removeChild(canvas);
    } catch (error) {
      console.error('Error generating PDF:', error);
    } finally {
      setIsGenerating(false);
    }
  };
  
  return (
    <Button
      onClick={generatePDF}
      className="w-full bg-blue-600 hover:bg-blue-700 text-white"
      disabled={isGenerating}
    >
      {isGenerating ? (
        <span className="flex items-center gap-2">
          <span className="animate-spin">⏳</span> Generating PDF...
        </span>
      ) : (
        <span className="flex items-center gap-2">
          <DownloadIcon className="w-4 h-4" /> Download Tax Report PDF
        </span>
      )}
    </Button>
  );
} 
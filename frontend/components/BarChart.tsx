import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  ChartOptions,
  ChartData
} from 'chart.js';
import { Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
);

interface MonthlyBarChartProps {
  monthlyData: Map<string, number>;
}

export const MonthlyBarChart = ({ monthlyData }: MonthlyBarChartProps) => {
  const allMonths = [
    'January', 'February', 'March', 'April', 
    'May', 'June', 'July', 'August',
    'September', 'October', 'November', 'December'
  ];

  const amounts = allMonths.map(month => monthlyData.get(month) || 0);
  const gstAmounts = amounts.map(amount => amount * 0.09); // 9% GST
  const cgstAmounts = amounts.map(amount => amount * 0.09); // 9% CGST

  const data: ChartData<'bar'> = {
    labels: allMonths,
    datasets: [
      {
        label: 'Amount',
        data: amounts,
        backgroundColor: 'rgba(234, 179, 8, 0.5)',
        borderColor: 'rgba(234, 179, 8, 0.8)',
        borderWidth: 1,
      },
      {
        label: 'GST (9%)',
        data: gstAmounts,
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgba(59, 130, 246, 0.8)',
        borderWidth: 1,
      },
      {
        label: 'CGST (9%)',
        data: cgstAmounts,
        backgroundColor: 'rgba(16, 185, 129, 0.5)',
        borderColor: 'rgba(16, 185, 129, 0.8)',
        borderWidth: 1,
      }
    ],
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    plugins: {
      title: {
        display: true,
        text: 'Monthly Expenditure Overview (with GST & CGST)',
        color: '#000000',
        font: {
          size: 16,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(17, 24, 39, 0.9)',
        titleColor: '#E5E7EB',
        bodyColor: '#E5E7EB',
        borderColor: 'rgba(234, 179, 8, 0.3)',
        borderWidth: 1,
        callbacks: {
          label: function(context) {
            if (context.parsed.y !== null) {
              return `${context.dataset.label}: ₹${context.parsed.y.toLocaleString()}`;
            }
            return '';
          },
        },
      },
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
        },
        ticks: {
          color: '#9CA3AF',
        },
      },
      y: {
        grid: {
          color: 'rgba(75, 85, 99, 0.2)',
        },
        ticks: {
          color: '#9CA3AF',
          callback: function(value) {
            if (typeof value === 'number') {
              return `₹${value.toLocaleString()}`;
            }
            return '';
          },
        },
      },
    },
  };

  return (
    <div className="w-full p-6 bg-white backdrop-blur-sm rounded-xl border border-gray-700">
      <Bar data={data} options={options} />
    </div>
  );
};
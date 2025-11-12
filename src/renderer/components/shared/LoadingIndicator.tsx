import React from 'react';

interface LoadingIndicatorProps {
  message?: string;
  size?: 'small' | 'medium' | 'large';
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({
  message = 'Loading...',
  size = 'medium',
}) => {
  const sizeMap = {
    small: '24px',
    medium: '48px',
    large: '72px',
  };

  const spinnerSize = sizeMap[size];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <div
        style={{
          width: spinnerSize,
          height: spinnerSize,
          border: '4px solid rgba(255, 255, 255, 0.1)',
          borderTop: '4px solid #0066cc',
          borderRadius: '50%',
          animation: 'spin 1s linear infinite',
        }}
      />
      {message && (
        <p
          style={{
            marginTop: '1rem',
            color: '#999',
            fontSize: '14px',
          }}
        >
          {message}
        </p>
      )}
      <style>
        {`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default LoadingIndicator;

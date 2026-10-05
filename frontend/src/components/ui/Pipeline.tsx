import type { PipelineStageStatus } from '@/types';
import { CheckCircle2, XCircle, Clock, Loader2, MinusCircle } from 'lucide-react';

export interface PipelineStep {
  label: string;
  status: PipelineStageStatus;
  description?: string;
}

export function Pipeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="flex flex-col gap-0">
      {steps.map((step, i) => (
        <div key={i} className="flex items-start gap-4">
          {/* Connector + icon */}
          <div className="flex flex-col items-center">
            <div className="w-9 h-9 rounded-full flex items-center justify-center border-2 transition-colors"
              style={{
                borderColor: step.status === 'completed' ? 'rgb(52 211 153)' :
                  step.status === 'failed' ? 'rgb(248 113 113)' :
                  step.status === 'in_progress' ? 'rgb(89 166 255)' :
                  step.status === 'skipped' ? 'rgb(107 114 128)' : 'rgb(45 51 59)',
                backgroundColor: step.status === 'completed' ? 'rgb(52 211 153 / 0.1)' :
                  step.status === 'failed' ? 'rgb(248 113 113 / 0.1)' :
                  step.status === 'in_progress' ? 'rgb(89 166 255 / 0.1)' :
                  step.status === 'skipped' ? 'rgb(107 114 128 / 0.05)' : 'transparent',
              }}
            >
              {step.status === 'completed' && <CheckCircle2 className="w-5 h-5 text-success-400" />}
              {step.status === 'failed' && <XCircle className="w-5 h-5 text-danger-400" />}
              {step.status === 'in_progress' && <Loader2 className="w-5 h-5 text-accent-400 animate-spin" />}
              {step.status === 'pending' && <Clock className="w-4 h-4 text-gray-600" />}
              {step.status === 'skipped' && <MinusCircle className="w-4 h-4 text-gray-600" />}
            </div>
            {i < steps.length - 1 && (
              <div className="w-0.5 h-8 mt-1"
                style={{
                  backgroundColor: step.status === 'completed' ? 'rgb(52 211 153 / 0.4)' : 'rgb(45 51 59)',
                }}
              />
            )}
          </div>

          {/* Content */}
          <div className="pb-6 flex-1">
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${
                step.status === 'completed' ? 'text-success-400' :
                step.status === 'failed' ? 'text-danger-400' :
                step.status === 'in_progress' ? 'text-accent-400' :
                step.status === 'skipped' ? 'text-gray-600' : 'text-gray-500'
              }`}>
                {step.label}
              </span>
              <span className={`text-xs uppercase tracking-wider ${
                step.status === 'completed' ? 'text-success-500' :
                step.status === 'failed' ? 'text-danger-500' :
                step.status === 'in_progress' ? 'text-accent-500' :
                step.status === 'skipped' ? 'text-gray-700' : 'text-gray-600'
              }`}>
                {step.status === 'in_progress' ? 'In Progress' :
                  step.status === 'completed' ? 'Completed' :
                  step.status === 'failed' ? 'Failed' :
                  step.status === 'skipped' ? 'Skipped' : 'Pending'}
              </span>
            </div>
            {step.description && (
              <p className="text-xs text-gray-500 mt-1">{step.description}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export function HorizontalPipeline({ steps }: { steps: PipelineStep[] }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2">
      {steps.map((step, i) => (
        <div key={i} className="flex items-center gap-1 flex-shrink-0">
          <div className="flex flex-col items-center gap-1 min-w-[100px]">
            <div className="w-8 h-8 rounded-full flex items-center justify-center border-2"
              style={{
                borderColor: step.status === 'completed' ? 'rgb(52 211 153)' :
                  step.status === 'failed' ? 'rgb(248 113 113)' :
                  step.status === 'in_progress' ? 'rgb(89 166 255)' :
                  step.status === 'skipped' ? 'rgb(107 114 128)' : 'rgb(45 51 59)',
                backgroundColor: step.status === 'completed' ? 'rgb(52 211 153 / 0.1)' :
                  step.status === 'in_progress' ? 'rgb(89 166 255 / 0.1)' : 'transparent',
              }}
            >
              {step.status === 'completed' && <CheckCircle2 className="w-4 h-4 text-success-400" />}
              {step.status === 'failed' && <XCircle className="w-4 h-4 text-danger-400" />}
              {step.status === 'in_progress' && <Loader2 className="w-4 h-4 text-accent-400 animate-spin" />}
              {step.status === 'pending' && <Clock className="w-3.5 h-3.5 text-gray-600" />}
              {step.status === 'skipped' && <MinusCircle className="w-3.5 h-3.5 text-gray-600" />}
            </div>
            <span className={`text-xs text-center ${
              step.status === 'completed' ? 'text-success-400' :
              step.status === 'failed' ? 'text-danger-400' :
              step.status === 'in_progress' ? 'text-accent-400' :
              'text-gray-500'
            }`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className="w-6 h-0.5 mb-5"
              style={{
                backgroundColor: step.status === 'completed' ? 'rgb(52 211 153 / 0.4)' : 'rgb(45 51 59)',
              }}
            />
          )}
        </div>
      ))}
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import {
  UploadCloud,
  FileText,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  Save,
  Check,
  X,
  RefreshCw,
  Building2,
  FileCheck2,
} from 'lucide-react';
import { Resume, Application, AnalysisResult } from '@/types';
import { resumesApi, applicationsApi, analyzerApi } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { formatFileSize, formatDate } from '@/lib/utils';
import { LoadingSpinner } from '@/components/common/LoadingSpinner';

export const ResumeAnalyzer: React.FC = () => {
  const [resumes, setResumes] = useState<Resume[]>([]);
  const [selectedResumeId, setSelectedResumeId] = useState<string>('');
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedAppId, setSelectedAppId] = useState<string>('manual');
  const [customJobDesc, setCustomJobDesc] = useState<string>('');
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch resumes and applications on mount
  useEffect(() => {
    loadResumes();
    loadApplications();
  }, []);

  const loadResumes = async () => {
    try {
      const res = await resumesApi.getAll();
      setResumes(res.data || []);
      if (res.data?.length > 0 && !selectedResumeId) {
        setSelectedResumeId(res.data[0].resume_id);
      }
    } catch {
      // Ignored for initial load
    }
  };

  const loadApplications = async () => {
    try {
      const res = await applicationsApi.getAll();
      setApplications(res.data || []);
    } catch {
      // Ignored
    }
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];

    const validExtensions = ['.pdf', '.docx'];
    const hasValidExt = validExtensions.some((ext) =>
      file.name.toLowerCase().endsWith(ext)
    );

    if (!hasValidExt) {
      toast.error('Only .pdf and .docx documents are supported');
      return;
    }

    try {
      setIsUploading(true);
      const res = await resumesApi.upload(file);
      toast.success('Resume uploaded successfully');
      await loadResumes();
      setSelectedResumeId(res.data.resume_id);
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload resume');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteResume = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await resumesApi.delete(id);
      toast.success('Resume deleted');
      setResumes((prev) => prev.filter((r) => r.resume_id !== id));
      if (selectedResumeId === id) {
        setSelectedResumeId(resumes.find((r) => r.resume_id !== id)?.resume_id || '');
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to delete resume');
    }
  };

  const handleRunAnalysis = async () => {
    if (!selectedResumeId) {
      toast.error('Please select or upload a resume');
      return;
    }

    let jobDescriptionText = customJobDesc;
    if (selectedAppId && selectedAppId !== 'manual') {
      const foundApp = applications.find((a) => a.application_id === selectedAppId);
      jobDescriptionText =
        foundApp?.job_description ||
        `Role: ${foundApp?.job_title} at ${foundApp?.company_name}. Required skills: ${foundApp?.required_skills?.join(', ')}`;
    }

    if (!jobDescriptionText.trim()) {
      toast.error('Please select a saved job or enter a job description');
      return;
    }

    try {
      setIsAnalyzing(true);
      const res = await analyzerApi.analyze({
        resume_id: selectedResumeId,
        application_id: selectedAppId !== 'manual' ? selectedAppId : undefined,
        job_description: jobDescriptionText,
      });

      setAnalysisResult(res.data);
      toast.success('Resume analysis complete!');
    } catch (err: any) {
      toast.error(err.message || 'Analysis failed. Check your Groq API key in Settings.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12">
      <div>
        <h2 className="text-xl font-bold tracking-tight">AI Resume & Job Matcher</h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Evaluate ATS compatibility, compare required qualifications, and get targeted keyword suggestions
        </p>
      </div>

      {/* Two Column Setup: Left = Resumes, Right = Target Job */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* LEFT: Resume Selection & Upload */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-base">1. Your Resumes</CardTitle>
            <CardDescription>
              Upload PDF or DOCX versions of your CV or resume
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag & Drop Upload Zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOver(false);
                handleFileUpload(e.dataTransfer.files);
              }}
              onClick={() => fileInputRef.current?.click()}
              className={`flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-xl cursor-pointer transition-colors ${
                dragOver
                  ? 'border-primary bg-primary/5'
                  : 'border-border/80 hover:border-primary/50 bg-muted/20'
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                className="hidden"
                onChange={(e) => handleFileUpload(e.target.files)}
              />
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary mb-2">
                <UploadCloud className="h-6 w-6" />
              </div>
              <p className="text-sm font-semibold">
                {isUploading ? 'Uploading file...' : 'Click or drag resume here'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports PDF and Word (.docx) up to 10MB
              </p>
            </div>

            {/* Uploaded Resumes List */}
            <div className="space-y-2 pt-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">
                Select Active Resume ({resumes.length})
              </Label>
              {resumes.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">
                  No resumes uploaded yet. Upload one above.
                </p>
              ) : (
                <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
                  {resumes.map((resume) => {
                    const isSelected = selectedResumeId === resume.resume_id;
                    return (
                      <div
                        key={resume.resume_id}
                        onClick={() => setSelectedResumeId(resume.resume_id)}
                        className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-primary bg-primary/5 ring-1 ring-primary/40'
                            : 'hover:bg-muted/40'
                        }`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <FileText
                            className={`h-5 w-5 shrink-0 ${
                              isSelected ? 'text-primary' : 'text-muted-foreground'
                            }`}
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">
                              {resume.filename}
                            </p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatFileSize(resume.size)} •{' '}
                              {formatDate(resume.uploaded_at, 'MMM d, yyyy')}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {isSelected && (
                            <Badge variant="default" className="text-[10px] h-5 px-1.5">
                              Active
                            </Badge>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            onClick={(e) => handleDeleteResume(resume.resume_id, e)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* RIGHT: Target Job Selection */}
        <Card className="shadow-sm flex flex-col justify-between">
          <div>
            <CardHeader>
              <CardTitle className="text-base">2. Target Job Requirements</CardTitle>
              <CardDescription>
                Compare against a tracked application or paste custom job requirements
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Choose Source</Label>
                <Select
                  value={selectedAppId}
                  onValueChange={(val) => setSelectedAppId(val)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select target job" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="manual">Enter Custom Job Description</SelectItem>
                    {applications.map((app) => (
                      <SelectItem
                        key={app.application_id}
                        value={app.application_id}
                      >
                        {app.company_name} — {app.job_title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedAppId === 'manual' ? (
                <div className="space-y-2">
                  <Label htmlFor="custom-job">Paste Job Description</Label>
                  <Textarea
                    id="custom-job"
                    rows={7}
                    placeholder="Paste role description, responsibilities, and required qualifications..."
                    value={customJobDesc}
                    onChange={(e) => setCustomJobDesc(e.target.value)}
                  />
                </div>
              ) : (
                <div className="rounded-lg border bg-muted/20 p-4 space-y-2">
                  {(() => {
                    const app = applications.find(
                      (a) => a.application_id === selectedAppId
                    );
                    if (!app) return null;
                    return (
                      <>
                        <div className="flex items-center justify-between">
                          <h4 className="font-semibold text-sm">{app.job_title}</h4>
                          <span className="text-xs text-muted-foreground">{app.company_name}</span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-4">
                          {app.job_description || 'No description entered. Required skills: ' + (app.required_skills?.join(', ') || 'None')}
                        </p>
                      </>
                    );
                  })()}
                </div>
              )}
            </CardContent>
          </div>

          <div className="p-6 pt-0">
            <Button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || !selectedResumeId}
              className="w-full gap-2 h-10 font-semibold"
            >
              <Sparkles className="h-4 w-4" />
              {isAnalyzing ? 'Analyzing ATS Match...' : 'Run Compatibility Analysis'}
            </Button>
          </div>
        </Card>
      </div>

      {/* ANALYSIS RESULTS SECTION */}
      {isAnalyzing && (
        <Card className="p-8">
          <LoadingSpinner label="AI is parsing resume keywords, skills matching, and experience scoring..." />
        </Card>
      )}

      {analysisResult && !isAnalyzing && (
        <div className="space-y-6 animate-in fade-in-50 duration-300">
          {/* Top Score Banner */}
          <Card className="overflow-hidden border-primary/30 shadow-md">
            <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 sm:p-6 border-b">
              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start text-center sm:text-left gap-4 sm:gap-6">
                  {/* Circular Score Gauge */}
                  <div className="relative flex h-24 w-24 items-center justify-center shrink-0">
                    <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                      <path
                        className="text-muted/30"
                        strokeWidth="3.5"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                      <path
                        className={
                          analysisResult.overall_score >= 75
                            ? 'text-emerald-500'
                            : analysisResult.overall_score >= 50
                            ? 'text-amber-500'
                            : 'text-rose-500'
                        }
                        strokeDasharray={`${analysisResult.overall_score}, 100`}
                        strokeWidth="3.5"
                        strokeLinecap="round"
                        stroke="currentColor"
                        fill="none"
                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-2xl font-black">
                        {analysisResult.overall_score}%
                      </span>
                      <span className="text-[9px] font-semibold text-muted-foreground uppercase">
                        Match
                      </span>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg sm:text-xl font-bold">Overall ATS Compatibility</h3>
                    <p className="text-xs text-muted-foreground mt-1 max-w-md">
                      {analysisResult.overall_score >= 75
                        ? 'Excellent match! Your resume strongly aligns with the core requirements and keywords.'
                        : analysisResult.overall_score >= 50
                        ? 'Good foundation with some missing technical skills or experience benchmarks.'
                        : 'Significant keyword and skill gaps detected. Recommended to tailor your resume.'}
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.print()}
                  className="gap-2 shrink-0 w-full sm:w-auto"
                >
                  <FileCheck2 className="h-4 w-4" />
                  Save / Export
                </Button>
              </div>
            </div>

            {/* 4 Mini Score Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x border-border/80">
              <div className="p-4 text-center">
                <span className="text-xs text-muted-foreground">Technical Skills</span>
                <p className="text-xl font-bold mt-1 text-foreground">
                  {analysisResult.technical_score}%
                </p>
                <Progress
                  value={analysisResult.technical_score}
                  className="h-1.5 mt-2"
                />
              </div>

              <div className="p-4 text-center">
                <span className="text-xs text-muted-foreground">Relevant Experience</span>
                <p className="text-xl font-bold mt-1 text-foreground">
                  {analysisResult.experience_score}%
                </p>
                <Progress
                  value={analysisResult.experience_score}
                  className="h-1.5 mt-2"
                />
              </div>

              <div className="p-4 text-center">
                <span className="text-xs text-muted-foreground">Education & Certs</span>
                <p className="text-xl font-bold mt-1 text-foreground">
                  {analysisResult.education_score}%
                </p>
                <Progress
                  value={analysisResult.education_score}
                  className="h-1.5 mt-2"
                />
              </div>

              <div className="p-4 text-center">
                <span className="text-xs text-muted-foreground">Keyword Density</span>
                <p className="text-xl font-bold mt-1 text-primary">
                  {analysisResult.overall_score}%
                </p>
                <Progress
                  value={analysisResult.overall_score}
                  className="h-1.5 mt-2"
                />
              </div>
            </div>
          </Card>

          {/* Matched vs Missing Skills */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Matched Skills */}
            <Card className="border-emerald-500/20 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <Check className="h-4 w-4" />
                  Matched Skills ({analysisResult.matched_skills?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {analysisResult.matched_skills?.map((skill, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-emerald-500/30 text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 text-xs px-2.5 py-1"
                    >
                      {skill}
                    </Badge>
                  ))}
                  {(!analysisResult.matched_skills ||
                    analysisResult.matched_skills.length === 0) && (
                    <p className="text-xs text-muted-foreground">No matches found</p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Missing Skills */}
            <Card className="border-rose-500/20 shadow-xs">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2 text-rose-600 dark:text-rose-400">
                  <X className="h-4 w-4" />
                  Missing or Recommended Keywords ({analysisResult.missing_skills?.length || 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {analysisResult.missing_skills?.map((skill, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="border-rose-500/30 text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-950/30 text-xs px-2.5 py-1"
                    >
                      + {skill}
                    </Badge>
                  ))}
                  {(!analysisResult.missing_skills ||
                    analysisResult.missing_skills.length === 0) && (
                    <p className="text-xs text-muted-foreground">
                      Great job! No major keyword omissions.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Recommendations & Strengths */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Strengths */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-emerald-500" />
                  Resume Strengths
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {analysisResult.strengths?.map((str, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-emerald-500 font-bold">•</span>
                      <span>{str}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>

            {/* Actionable Recommendations */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Actionable Improvements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-xs text-muted-foreground">
                  {analysisResult.recommendations?.map((rec, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className="text-amber-500 font-bold">•</span>
                      <span>{rec}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResumeAnalyzer;

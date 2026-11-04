import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Globe,
  FileText,
  Sparkles,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Building2,
  Briefcase,
  MapPin,
  DollarSign,
  Save,
} from 'lucide-react';
import { ExtractedJob, ApplicationStatus, WorkMode, EmploymentType } from '@/types';
import { extractorApi, applicationsApi } from '@/lib/api';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';

type ExtractionStep = 'input' | 'preview' | 'success';

export const JobExtractor: React.FC = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<ExtractionStep>('input');
  const [inputMode, setInputMode] = useState<'url' | 'text'>('url');
  const [url, setUrl] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [progressMsg, setProgressMsg] = useState<string>('');
  const [extractedData, setExtractedData] = useState<ExtractedJob | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<ApplicationStatus>('Wishlist');
  const [isSaving, setIsSaving] = useState<boolean>(false);

  const handleExtract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (inputMode === 'url' && !url.trim()) {
      toast.error('Please enter a job posting URL');
      return;
    }
    if (inputMode === 'text' && !rawText.trim()) {
      toast.error('Please paste the job description text');
      return;
    }

    try {
      setLoading(true);
      setProgressMsg('Connecting to source page...');

      const timer1 = setTimeout(() => {
        setProgressMsg('Analyzing content with AI...');
      }, 1200);

      const timer2 = setTimeout(() => {
        setProgressMsg('Extracting company, skills & compensation...');
      }, 2400);

      let response;
      if (inputMode === 'url') {
        response = await extractorApi.extract(url.trim());
      } else {
        response = await extractorApi.extractRaw(rawText.trim());
      }

      clearTimeout(timer1);
      clearTimeout(timer2);

      const data = response.data;
      setExtractedData({
        ...data,
        job_url: inputMode === 'url' ? url.trim() : data.job_url,
      });
      setStep('preview');
      toast.success('Job details extracted successfully!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to extract job information');
    } finally {
      setLoading(false);
      setProgressMsg('');
    }
  };

  const handleSaveApplication = async () => {
    if (!extractedData) return;
    try {
      setIsSaving(true);
      await applicationsApi.create({
        company_name: extractedData.company_name,
        company_website: extractedData.company_website,
        job_title: extractedData.job_title,
        job_description: extractedData.job_description,
        job_url: extractedData.job_url,
        location: extractedData.location,
        work_mode: extractedData.work_mode,
        employment_type: extractedData.employment_type,
        experience_required: extractedData.experience_required,
        salary_range: extractedData.salary_range,
        required_skills: extractedData.required_skills,
        application_status: selectedStatus,
        date_discovered: new Date().toISOString().split('T')[0],
      });
      setStep('success');
      toast.success('Application saved to pipeline!');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save application');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setUrl('');
    setRawText('');
    setExtractedData(null);
    setStep('input');
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      {/* Steps Progress Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 border-b pb-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">AI Job Extractor</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Automatically parse job titles, requirements, skills, and salaries from any posting
          </p>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
          <div
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
              step === 'input'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <span>1</span> Input
          </div>
          <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0" />
          <div
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
              step === 'preview'
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <span>2</span> Review & Edit
          </div>
          <ArrowRight className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-muted-foreground shrink-0" />
          <div
            className={`flex items-center gap-1.5 px-2.5 sm:px-3 py-1 rounded-full text-xs font-semibold shrink-0 ${
              step === 'success'
                ? 'bg-emerald-600 text-white'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <span>3</span> Done
          </div>
        </div>
      </div>

      {/* STEP 1: Input Mode */}
      {step === 'input' && (
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-lg">Step 1: Provide Job Posting</CardTitle>
            <CardDescription>
              Enter the URL of a job posting or paste the job description text directly.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={inputMode}
              onValueChange={(val) => setInputMode(val as 'url' | 'text')}
              className="space-y-4"
            >
              <TabsList className="grid w-full grid-cols-2 max-w-sm">
                <TabsTrigger value="url" className="gap-2">
                  <Globe className="h-4 w-4" />
                  URL Link
                </TabsTrigger>
                <TabsTrigger value="text" className="gap-2">
                  <FileText className="h-4 w-4" />
                  Paste Text
                </TabsTrigger>
              </TabsList>

              <TabsContent value="url" className="space-y-4 pt-2">
                <form onSubmit={handleExtract} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="job-url">Job Listing URL</Label>
                    <div className="relative">
                      <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="job-url"
                        type="url"
                        placeholder="https://www.linkedin.com/jobs/view/... or Greenhouse, Lever URL"
                        value={url}
                        onChange={(e) => setUrl(e.target.value)}
                        className="pl-10 h-10"
                        disabled={loading}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Works with LinkedIn, Indeed, Glassdoor, Lever, Greenhouse, Workday, and company career pages.
                    </p>
                  </div>

                  <Button
                    type="submit"
                    className="w-full sm:w-auto gap-2"
                    disabled={loading || !url.trim()}
                  >
                    <Sparkles className="h-4 w-4" />
                    {loading ? (progressMsg || 'Extracting...') : 'Extract Job Details'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="text" className="space-y-4 pt-2">
                <form onSubmit={handleExtract} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="job-text">Paste Job Description Text</Label>
                    <Textarea
                      id="job-text"
                      rows={8}
                      placeholder="Paste the full job posting text here (job title, requirements, qualifications, benefits)..."
                      value={rawText}
                      onChange={(e) => setRawText(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full sm:w-auto gap-2"
                    disabled={loading || !rawText.trim()}
                  >
                    <Sparkles className="h-4 w-4" />
                    {loading ? (progressMsg || 'Analyzing...') : 'Parse with AI'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {loading && (
              <div className="mt-6 rounded-lg border bg-muted/40 p-4 text-center space-y-2 animate-pulse">
                <div className="flex items-center justify-center gap-2 text-sm font-semibold text-primary">
                  <Sparkles className="h-4 w-4 animate-spin" />
                  {progressMsg}
                </div>
                <p className="text-xs text-muted-foreground">
                  Our LLM is analyzing company metadata, responsibilities, compensation, and ATS skills.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* STEP 2: Preview & Edit */}
      {step === 'preview' && extractedData && (
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg">Step 2: Review Extracted Information</CardTitle>
              <CardDescription>
                Verify and adjust the parsed details before saving to your applications pipeline.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5 text-xs self-start sm:self-auto">
              <RotateCcw className="h-3.5 w-3.5" /> Start Over
            </Button>
          </CardHeader>

          <CardContent className="space-y-5">
            {/* Core Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="company_name">Company Name</Label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="company_name"
                    value={extractedData.company_name || ''}
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, company_name: e.target.value })
                    }
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="job_title">Job Title</Label>
                <div className="relative">
                  <Briefcase className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="job_title"
                    value={extractedData.job_title || ''}
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, job_title: e.target.value })
                    }
                    className="pl-9"
                  />
                </div>
              </div>
            </div>

            {/* Location & Work Mode */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="location">Location</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="location"
                    value={extractedData.location || ''}
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, location: e.target.value })
                    }
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>Work Mode</Label>
                <Select
                  value={extractedData.work_mode || 'Remote'}
                  onValueChange={(val) =>
                    setExtractedData({ ...extractedData, work_mode: val as WorkMode })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Remote">Remote</SelectItem>
                    <SelectItem value="Hybrid">Hybrid</SelectItem>
                    <SelectItem value="Onsite">Onsite</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label>Employment Type</Label>
                <Select
                  value={extractedData.employment_type || 'FullTime'}
                  onValueChange={(val) =>
                    setExtractedData({
                      ...extractedData,
                      employment_type: val as EmploymentType,
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FullTime">Full Time</SelectItem>
                    <SelectItem value="PartTime">Part Time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                    <SelectItem value="Internship">Internship</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Salary & Experience */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="salary_range">Salary Range</Label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="salary_range"
                    value={extractedData.salary_range || ''}
                    onChange={(e) =>
                      setExtractedData({ ...extractedData, salary_range: e.target.value })
                    }
                    className="pl-9"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="experience">Experience Required</Label>
                <Input
                  id="experience"
                  value={extractedData.experience_required || ''}
                  onChange={(e) =>
                    setExtractedData({
                      ...extractedData,
                      experience_required: e.target.value,
                    })
                  }
                />
              </div>
            </div>

            {/* Extracted Skills */}
            <div className="space-y-2">
              <Label>Extracted Skills & Keywords</Label>
              <div className="flex flex-wrap gap-1.5 p-3 rounded-lg border bg-muted/20">
                {extractedData.required_skills && extractedData.required_skills.length > 0 ? (
                  extractedData.required_skills.map((skill, index) => (
                    <Badge key={index} variant="secondary" className="text-xs">
                      {skill}
                    </Badge>
                  ))
                ) : (
                  <span className="text-xs text-muted-foreground">No specific skills parsed</span>
                )}
              </div>
            </div>

            {/* Full Description */}
            <div className="space-y-1.5">
              <Label htmlFor="desc">Parsed Job Description</Label>
              <Textarea
                id="desc"
                rows={4}
                value={extractedData.job_description || ''}
                onChange={(e) =>
                  setExtractedData({
                    ...extractedData,
                    job_description: e.target.value,
                  })
                }
              />
            </div>

            {/* Select Destination Status */}
            <div className="rounded-lg border bg-primary/5 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-semibold">Save to Stage</Label>
                <p className="text-xs text-muted-foreground">
                  Choose which column to add this application to
                </p>
              </div>
              <div className="w-48">
                <Select
                  value={selectedStatus}
                  onValueChange={(val) => setSelectedStatus(val as ApplicationStatus)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Wishlist">Wishlist</SelectItem>
                    <SelectItem value="Applied">Applied</SelectItem>
                    <SelectItem value="Assessment">Assessment</SelectItem>
                    <SelectItem value="Interview">Interview</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 sm:gap-3 border-t pt-4">
            <Button variant="outline" onClick={handleReset} className="w-full sm:w-auto">
              Cancel
            </Button>
            <Button onClick={handleSaveApplication} disabled={isSaving} className="gap-2 w-full sm:w-auto font-semibold">
              <Save className="h-4 w-4" />
              {isSaving ? 'Saving...' : 'Save to Pipeline'}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* STEP 3: Success Screen */}
      {step === 'success' && (
        <Card className="text-center p-8 shadow-sm">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 mb-4 ring-8 ring-emerald-50 dark:ring-emerald-950/40">
            <CheckCircle2 className="h-8 w-8" />
          </div>
          <CardTitle className="text-xl font-bold">
            Job Saved Successfully!
          </CardTitle>
          <CardDescription className="max-w-md mx-auto mt-2">
            The role at <strong className="text-foreground">{extractedData?.company_name}</strong> has been added to your{' '}
            <strong className="text-primary">{selectedStatus}</strong> stage.
          </CardDescription>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              variant="outline"
              onClick={handleReset}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Extract Another Job
            </Button>
            <Button
              onClick={() => navigate('/applications')}
              className="gap-2"
            >
              <Briefcase className="h-4 w-4" />
              View in Applications
            </Button>
            <Button
              variant="secondary"
              onClick={() => navigate('/analyzer')}
              className="gap-2"
            >
              <Sparkles className="h-4 w-4" />
              Analyze Resume for this Job
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
};

export default JobExtractor;

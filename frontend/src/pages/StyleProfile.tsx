import React, { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Sparkles, Edit, Plus, Loader } from 'lucide-react';

import authAPI from '../services/authAPI';
import { API_URL } from '../config/env';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { TagChip } from '../components/TagChip';
import { mockImages, mockStyleProfile } from '../lib/mockData';

const USE_STYLE_PROFILE_MOCK = false;

interface ApiStyleProfile {
  summaryText?: string;
  styleLabels?: Array<{ name: string; score?: number; count?: number }>;
  clusters?: Array<{
    name?: string;
    cluster_name?: string;
    weight?: number;
    score?: number;
    description?: string;
    signatureDetails?: string[];
    topDescriptors?: string[];
  }>;
  distributions?: {
    garments?: Record<string, number>;
    colors?: Record<string, number>;
    fabrics?: Record<string, number>;
    silhouettes?: Record<string, number>;
  };
  totalImages?: number;
  generatedCount?: number;
  totalGenerations?: number;
  portfolioImages?: Array<{ url: string }>;
}

interface StyleProfileData {
  summaryText: string;
  styleLabels: Array<{ name: string; score: number }>;
  distributions: {
    garments: Record<string, number>;
    colors: Record<string, number>;
    fabrics: Record<string, number>;
    silhouettes: Record<string, number>;
  };
  clusters: Array<{
    name: string;
    weight: number;
    description: string;
    signatureDetails: string[];
  }>;
  portfolioCount: number;
  generatedCount: number;
  portfolioSamples: string[];
}

const percentify = (value: number | undefined): number => {
  if (!value && value !== 0) return 0;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return 0;
  return numeric <= 1 ? Math.round(numeric * 100) : Math.round(numeric);
};

const normalizeDistribution = (
  distribution: Record<string, number> | undefined
): Record<string, number> => {
  if (!distribution) return {};
  return Object.fromEntries(
    Object.entries(distribution).map(([key, value]) => [
      key,
      percentify(value),
    ])
  );
};

const normalizeProfile = (raw: ApiStyleProfile): StyleProfileData => {
  return {
    summaryText:
      raw.summaryText ||
      'Upload a portfolio to generate your first style profile.',
    styleLabels: (raw.styleLabels || []).map((label) => ({
      name: label.name,
      score: label.score ?? label.count ?? 0,
    })),
    distributions: {
      garments: normalizeDistribution(raw.distributions?.garments),
      colors: normalizeDistribution(raw.distributions?.colors),
      fabrics: normalizeDistribution(raw.distributions?.fabrics),
      silhouettes: normalizeDistribution(raw.distributions?.silhouettes),
    },
    clusters: (raw.clusters || []).map((cluster) => ({
      name: cluster.name || cluster.cluster_name || 'Untitled cluster',
      weight: percentify(cluster.weight ?? cluster.score ?? 0),
      description:
        cluster.description ||
        'Key looks and descriptors captured from your portfolio.',
      signatureDetails:
        cluster.signatureDetails || cluster.topDescriptors || [],
    })),
    portfolioCount: raw.totalImages ?? 0,
    generatedCount: raw.generatedCount ?? raw.totalGenerations ?? 0,
    portfolioSamples: (raw.portfolioImages || [])
      .slice(0, 5)
      .map((image) => image.url),
  };
};

const buildMockProfile = (): StyleProfileData => ({
  ...mockStyleProfile,
  portfolioSamples: mockImages.slice(0, 5).map((image) => image.url),
});

const StyleProfilePage: React.FC = () => {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<StyleProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    const currentUser = authAPI.getCurrentUser();
    const token = authAPI.getToken();

    if (!currentUser) {
      navigate('/signup');
      return;
    }

    if (USE_STYLE_PROFILE_MOCK) {
      setProfile(buildMockProfile());
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      setLoading(true);
      setError(null);

      try {
        const response = await fetch(`${API_URL}/podna/profile`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          if (response.status === 404) {
            setError(
              'No style profile found yet. Upload a portfolio to generate insights.'
            );
          } else {
            setError('Unable to load style profile. Please try again later.');
          }
          return;
        }

        const result = await response.json();
        if (result.success && result.data?.profile) {
          setProfile(normalizeProfile(result.data.profile as ApiStyleProfile));
        } else {
          setProfile(null);
          setError('Style profile data is unavailable.');
        }
      } catch (err: any) {
        console.error('Error loading style profile:', err);
        setError(err.message || 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [navigate]);

  const handleGenerateStyle = (clusterName: string) => {
    window.alert(
      `Starting a generation focused on ${clusterName}. (Integration coming soon.)`
    );
  };

  const getDistributionEntries = (
    distribution: Record<string, number>
  ): Array<[string, number]> => {
    return Object.entries(distribution).sort((a, b) => b[1] - a[1]);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <Loader className="h-10 w-10 animate-spin text-gray-900" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-white px-6 py-16">
        <div className="mx-auto max-w-3xl rounded-2xl border border-gray-200 bg-red-50 p-8 text-center">
          <p className="text-red-600">{error}</p>
          <div className="mt-6 flex justify-center gap-3">
            <Button variant="outline" onClick={() => navigate('/onboarding')}>
              Upload portfolio
            </Button>
            <Button onClick={() => navigate('/generate')}>
              Generate new looks
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-24">
      <div className="mx-auto max-w-6xl px-6 py-10 space-y-10">
        <Card className="border-0 bg-gradient-to-r from-[#6366f1]/10 to-[#8b5cf6]/10">
          <CardHeader>
            <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
              <div className="space-y-3">
                <CardTitle className="flex items-center gap-2 text-2xl font-light">
                  Your Style DNA
                </CardTitle>
                <CardDescription className="max-w-3xl text-base text-gray-700">
                  {profile.summaryText}
                </CardDescription>
              </div>
              <Button variant="outline" size="icon">
                <Edit className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-6 text-sm text-gray-600">
            <div>
              <span className="text-gray-500">Portfolio images analysed</span>{' '}
              <span className="text-gray-900">{profile.portfolioCount}</span>
            </div>
            <div>
              <span className="text-gray-500">Generations to date</span>{' '}
              <span className="text-gray-900">{profile.generatedCount}</span>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="rounded-xl border border-yellow-200 bg-yellow-50 p-4 text-sm text-yellow-800">
            {error}
          </div>
        )}

        <section className="space-y-6">
          <h2 className="text-xl font-medium text-gray-900">
            Aesthetic Clusters
          </h2>
          <div className="grid gap-6 md:grid-cols-2">
            {profile.clusters.map((cluster) => (
              <Card
                key={cluster.name}
                className="transition-all duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <CardHeader className="space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        {cluster.name}
                        <Badge variant="outline">{cluster.weight}%</Badge>
                      </CardTitle>
                      <CardDescription>{cluster.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-gray-500">
                      Signature details
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {cluster.signatureDetails.map((detail) => (
                        <Badge key={detail} variant="secondary">
                          {detail}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    onClick={() => handleGenerateStyle(cluster.name)}
                    className="w-full bg-[#6366f1] text-white hover:bg-[#4f46e5]"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate {cluster.name} looks
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>Style Labels</CardTitle>
                  <CardDescription>
                    A shorthand of how Podna interprets your brand
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" className="rounded-full">
                  <Plus className="mr-1 h-4 w-4" />
                  Add label
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              {profile.styleLabels.map((label) => (
                <TagChip
                  key={label.name}
                  tag={`${label.name}`}
                  category="style"
                  removable={false}
                  onClick={() =>
                    window.alert(`Filter gallery by ${label.name} (coming soon)`)
                  }
                />
              ))}
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top Garments</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {getDistributionEntries(profile.distributions.garments).map(
                ([garment, value]) => (
                  <div key={garment}>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{garment}</span>
                      <span className="font-medium text-gray-900">
                        {value}%
                      </span>
                    </div>
                    <Progress value={value} className="h-2" />
                  </div>
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Signature Colours</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {getDistributionEntries(profile.distributions.colors)
                .slice(0, 6)
                .map(([color, value]) => (
                  <div key={color}>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{color}</span>
                      <span className="font-medium text-gray-900">
                        {value}%
                      </span>
                    </div>
                    <Progress value={value} className="h-2" />
                  </div>
                ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preferred Fabrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {getDistributionEntries(profile.distributions.fabrics).map(
                ([fabric, value]) => (
                  <div key={fabric}>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{fabric}</span>
                      <span className="font-medium text-gray-900">
                        {value}%
                      </span>
                    </div>
                    <Progress value={value} className="h-2" />
                  </div>
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Silhouette Bias</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {getDistributionEntries(profile.distributions.silhouettes).map(
                ([silhouette, value]) => (
                  <div key={silhouette}>
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>{silhouette}</span>
                      <span className="font-medium text-gray-900">
                        {value}%
                      </span>
                    </div>
                    <Progress value={value} className="h-2" />
                  </div>
                )
              )}
            </CardContent>
          </Card>
        </section>

        <section>
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <CardTitle>
                    Portfolio Images ({profile.portfolioCount})
                  </CardTitle>
                  <CardDescription>
                    Core looks powering your brand DNA analysis
                  </CardDescription>
                </div>
                <Button variant="outline" disabled>
                  <Plus className="mr-2 h-4 w-4" />
                  Add more images
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-5">
                {(profile.portfolioSamples.length
                  ? profile.portfolioSamples
                  : Array.from({ length: 5 })
                ).map((sample, index) => (
                  <div
                    key={sample ?? index}
                    className="aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                  >
                    {sample ? (
                      <img
                        src={sample}
                        alt={`Portfolio sample ${index + 1}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <Sparkles className="h-6 w-6" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-4 text-sm text-gray-500">
                Uploading additional looks will refine your clusters and increase
                accuracy across future generations.
              </p>
            </CardContent>
          </Card>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 pt-6 text-sm text-gray-500">
          <div>
            Want to refresh your DNA?{' '}
            <button
              className="font-medium text-gray-900 underline-offset-4 hover:underline"
              onClick={() => navigate('/onboarding')}
            >
              Re-upload portfolio
            </button>
          </div>
          <div>
            Ready to explore?{' '}
            <button
              className="font-medium text-gray-900 underline-offset-4 hover:underline"
              onClick={() => navigate('/generate')}
            >
              Generate new looks
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StyleProfilePage;

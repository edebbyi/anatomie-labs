"""
Stage 2: Style Profile Clustering using GMM
Aggregates VLT data into style clusters to identify user's fashion preferences
"""
import numpy as np
from sklearn.mixture import GaussianMixture as GaussianMixtureModel
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import joblib
import os
import logging
from typing import List, Dict, Any, Optional
from collections import defaultdict

logger = logging.getLogger(__name__)


class StyleProfiler:
    """
    GMM-based style profiler for fashion portfolio analysis
    Implements Stage 2 of Designer BFF pipeline
    """
    
    def __init__(self, models_dir: str = "./models"):
        self.models_dir = models_dir
        os.makedirs(models_dir, exist_ok=True)
        
        # Cache for user profiles
        self.profiles = {}
        
        # Feature extraction configuration
        self.feature_keys = [
            'silhouette', 'neckline', 'sleeveLength', 'length',
            'waistline', 'fabrication', 'primary_color', 'finish',
            'overall_style', 'formality', 'aesthetic', 'mood'
        ]
        
        logger.info("StyleProfiler initialized")
    
    def create_profile(
        self,
        user_id: str,
        vlt_records: List[Dict[str, Any]],
        n_clusters: int = 5
    ) -> Dict[str, Any]:
        """
        Create initial style profile using GMM clustering
        
        Args:
            user_id: User identifier
            vlt_records: List of VLT analysis results
            n_clusters: Number of style clusters (modes)
        
        Returns:
            Style profile with clusters and statistics
        """
        logger.info(f"Creating style profile for {user_id} with {len(vlt_records)} records")
        
        if len(vlt_records) < n_clusters:
            logger.warning(f"Only {len(vlt_records)} records, reducing clusters to {len(vlt_records)}")
            n_clusters = max(1, len(vlt_records))
        
        # Extract features from VLT records
        features, feature_names = self._extract_features(vlt_records)
        
        # Normalize features
        scaler = StandardScaler()
        features_scaled = scaler.fit_transform(features)
        
        # Apply PCA for dimensionality reduction
        # n_components must be <= min(n_samples, n_features)
        n_pca_components = min(10, features_scaled.shape[0], features_scaled.shape[1])
        pca = PCA(n_components=n_pca_components)
        features_pca = pca.fit_transform(features_scaled)
        
        # Fit GMM
        gmm = GaussianMixtureModel(
            n_components=n_clusters,
            covariance_type='full',
            random_state=42,
            max_iter=100
        )
        
        cluster_labels = gmm.fit_predict(features_pca)
        probabilities = gmm.predict_proba(features_pca)
        
        # Analyze clusters
        clusters = self._analyze_clusters(
            vlt_records, 
            cluster_labels, 
            probabilities,
            features,
            feature_names
        )
        
        # Create profile
        profile = {
            'user_id': user_id,
            'n_records': len(vlt_records),
            'n_clusters': n_clusters,
            'clusters': clusters,
            'statistics': self._compute_statistics(vlt_records, clusters),
            'feature_importance': self._compute_feature_importance(features, feature_names, cluster_labels),
            'created_at': np.datetime64('now').astype(str),
            'updated_at': np.datetime64('now').astype(str)
        }
        
        # Save model and profile
        self._save_profile(user_id, profile, gmm, scaler, pca)
        
        # Cache
        self.profiles[user_id] = profile
        
        logger.info(f"Style profile created with {n_clusters} clusters")
        
        return profile
    
    def update_profile(
        self,
        user_id: str,
        new_vlt_records: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Update existing profile with new VLT data
        Uses online learning to adapt clusters
        """
        logger.info(f"Updating style profile for {user_id} with {len(new_vlt_records)} new records")
        
        # Load existing profile
        profile = self.get_profile(user_id)
        if not profile:
            raise ValueError(f"No existing profile found for user {user_id}")
        
        # Load models
        gmm, scaler, pca = self._load_models(user_id)
        
        # Extract features from new records
        new_features, feature_names = self._extract_features(new_vlt_records)
        new_features_scaled = scaler.transform(new_features)
        new_features_pca = pca.transform(new_features_scaled)
        
        # Predict clusters for new data
        new_labels = gmm.predict(new_features_pca)
        new_probabilities = gmm.predict_proba(new_features_pca)
        
        # Update cluster statistics (online update)
        updated_clusters = self._update_cluster_stats(
            profile['clusters'],
            new_vlt_records,
            new_labels,
            new_probabilities,
            new_features,
            feature_names
        )
        
        # Update profile
        profile['clusters'] = updated_clusters
        profile['n_records'] += len(new_vlt_records)
        profile['updated_at'] = np.datetime64('now').astype(str)
        
        # Recompute statistics
        all_vlt_records = self._get_all_vlt_records(user_id)  # Would need to fetch from DB
        profile['statistics'] = self._compute_statistics(all_vlt_records, updated_clusters)
        
        # Save updated profile
        self._save_profile(user_id, profile, gmm, scaler, pca)
        self.profiles[user_id] = profile
        
        logger.info(f"Profile updated, now with {profile['n_records']} total records")
        
        return profile
    
    def get_profile(self, user_id: str) -> Optional[Dict[str, Any]]:
        """Get cached or load profile from disk"""
        if user_id in self.profiles:
            return self.profiles[user_id]
        
        profile_path = os.path.join(self.models_dir, f"{user_id}_profile.joblib")
        if os.path.exists(profile_path):
            profile = joblib.load(profile_path)
            self.profiles[user_id] = profile
            return profile
        
        return None
    
    def _extract_features(self, vlt_records: List[Dict[str, Any]]) -> tuple:
        """
        Extract numerical features from VLT records
        Uses one-hot encoding for categorical variables
        """
        feature_vectors = []
        feature_names = []
        
        # Collect all unique values for categorical variables
        categorical_values = defaultdict(set)
        for record in vlt_records:
            attrs = record.get('attributes', {})
            colors = record.get('colors', {})
            style = record.get('style', {})
            
            for key in ['silhouette', 'neckline', 'sleeveLength', 'length', 'waistline', 'fabrication']:
                if key in attrs:
                    categorical_values[key].add(attrs[key])
            
            if 'primary' in colors:
                categorical_values['primary_color'].add(colors['primary'])
            if 'finish' in colors:
                categorical_values['finish'].add(colors['finish'])
            
            for key in ['overall', 'formality', 'aesthetic', 'mood']:
                if key in style:
                    categorical_values[key].add(style[key])
        
        # Create one-hot encoding
        for record in vlt_records:
            feature_vector = []
            
            attrs = record.get('attributes', {})
            colors = record.get('colors', {})
            style = record.get('style', {})
            
            # One-hot encode each categorical variable
            for key, values in categorical_values.items():
                for value in sorted(values):
                    if key in ['silhouette', 'neckline', 'sleeveLength', 'length', 'waistline', 'fabrication']:
                        feature_vector.append(1.0 if attrs.get(key) == value else 0.0)
                    elif key == 'primary_color':
                        feature_vector.append(1.0 if colors.get('primary') == value else 0.0)
                    elif key == 'finish':
                        feature_vector.append(1.0 if colors.get('finish') == value else 0.0)
                    else:
                        feature_vector.append(1.0 if style.get(key.split('_')[0] if '_' in key else key) == value else 0.0)
                    
                    if len(feature_vectors) == 0:
                        feature_names.append(f"{key}_{value}")
            
            feature_vectors.append(feature_vector)
        
        return np.array(feature_vectors), feature_names
    
    def _analyze_clusters(
        self,
        vlt_records: List[Dict[str, Any]],
        labels: np.ndarray,
        probabilities: np.ndarray,
        features: np.ndarray,
        feature_names: List[str]
    ) -> List[Dict[str, Any]]:
        """Analyze and characterize each cluster"""
        clusters = []
        n_clusters = labels.max() + 1
        
        for cluster_id in range(n_clusters):
            cluster_mask = labels == cluster_id
            cluster_records = [r for i, r in enumerate(vlt_records) if cluster_mask[i]]
            cluster_features = features[cluster_mask]
            cluster_probs = probabilities[cluster_mask, cluster_id]
            
            # Find dominant attributes
            dominant_attrs = self._find_dominant_attributes(cluster_records)
            
            # Compute cluster statistics
            cluster_info = {
                'id': cluster_id,
                'size': int(cluster_mask.sum()),
                'percentage': float(cluster_mask.sum() / len(vlt_records) * 100),
                'dominant_attributes': dominant_attrs,
                'centroid_confidence': float(cluster_probs.mean()),
                'representative_records': self._find_representative_records(cluster_records, cluster_probs),
                'style_summary': self._summarize_cluster_style(dominant_attrs)
            }
            
            clusters.append(cluster_info)
        
        # Sort by size
        clusters.sort(key=lambda x: x['size'], reverse=True)
        
        return clusters
    
    def _find_dominant_attributes(self, records: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Find most common attributes in a cluster"""
        attr_counts = defaultdict(lambda: defaultdict(int))
        
        for record in records:
            attrs = record.get('attributes', {})
            colors = record.get('colors', {})
            style = record.get('style', {})
            
            for key, value in attrs.items():
                attr_counts[key][value] += 1
            
            if 'primary' in colors:
                attr_counts['color'][colors['primary']] += 1
            
            for key, value in style.items():
                attr_counts[f'style_{key}'][value] += 1
        
        # Find most common value for each attribute
        dominant = {}
        for attr_name, values in attr_counts.items():
            dominant[attr_name] = max(values.items(), key=lambda x: x[1])
        
        return dominant
    
    def _find_representative_records(
        self,
        records: List[Dict[str, Any]],
        probabilities: np.ndarray,
        n_representatives: int = 3
    ) -> List[str]:
        """Find most representative records in cluster"""
        top_indices = np.argsort(probabilities)[-n_representatives:][::-1]
        return [records[i].get('imageId', records[i].get('id', f'record_{i}')) for i in top_indices if i < len(records)]
    
    def _summarize_cluster_style(self, dominant_attrs: Dict[str, Any]) -> str:
        """
        Generate Stage 2 style profile names based on dominant attributes
        Creates names like 'Minimalist Tailoring', 'Fluid Evening', 'Experimental Edge'
        """
        # Extract key attributes for classification
        overall_style = dominant_attrs.get('style_overall', ['unknown', 0])[0].lower() if 'style_overall' in dominant_attrs else 'unknown'
        aesthetic = dominant_attrs.get('style_aesthetic', ['unknown', 0])[0].lower() if 'style_aesthetic' in dominant_attrs else 'unknown'
        silhouette = dominant_attrs.get('silhouette', ['unknown', 0])[0].lower() if 'silhouette' in dominant_attrs else 'unknown'
        color = dominant_attrs.get('color', ['unknown', 0])[0].lower() if 'color' in dominant_attrs else 'unknown'
        fabrication = dominant_attrs.get('fabrication', ['unknown', 0])[0].lower() if 'fabrication' in dominant_attrs else 'unknown'
        formality = dominant_attrs.get('style_formality', ['unknown', 0])[0].lower() if 'style_formality' in dominant_attrs else 'unknown'
        
        # Style profile classification logic based on Stage 2 specifications
        
        # Minimalist Tailoring: structured, clean, professional
        if ('minimalist' in aesthetic or 'clean' in aesthetic or 
            'structured' in silhouette or 'tailored' in silhouette or
            'professional' in overall_style or 'formal' in formality or
            'wool' in fabrication or 'suiting' in fabrication):
            return "Minimalist Tailoring"
        
        # Fluid Evening: elegant, flowing, sophisticated
        elif ('elegant' in aesthetic or 'sophisticated' in aesthetic or
              'fluid' in silhouette or 'flowing' in silhouette or 'a-line' in silhouette or
              'evening' in overall_style or 'formal' in overall_style or
              'silk' in fabrication or 'charmeuse' in fabrication or
              'glossy' in color):
            return "Fluid Evening"
        
        # Experimental Edge: avant-garde, deconstructed, technical
        elif ('experimental' in aesthetic or 'avant' in aesthetic or 'edgy' in aesthetic or
              'deconstructed' in silhouette or 'asymmetric' in silhouette or
              'technical' in fabrication or 'innovative' in fabrication or
              'unconventional' in overall_style):
            return "Experimental Edge"
        
        # Sporty Chic: athletic-inspired, comfortable, modern
        elif ('sporty' in aesthetic or 'athletic' in aesthetic or 'casual' in aesthetic or
              'relaxed' in silhouette or 'loose' in silhouette or
              'sporty' in overall_style or 'casual' in overall_style or
              'jersey' in fabrication or 'knit' in fabrication):
            return "Sporty Chic"
        
        # Romantic Bohemian: feminine, flowing, artistic
        elif ('romantic' in aesthetic or 'bohemian' in aesthetic or 'feminine' in aesthetic or
              'flowing' in silhouette or 'draped' in silhouette or
              'boho' in overall_style or 'artistic' in overall_style or
              'chiffon' in fabrication or 'lace' in fabrication):
            return "Romantic Bohemian"
        
        # Urban Contemporary: modern, versatile, city-ready
        elif ('contemporary' in aesthetic or 'modern' in aesthetic or 'urban' in aesthetic or
              'versatile' in overall_style or 'smart-casual' in overall_style or
              'cotton' in fabrication or 'denim' in fabrication):
            return "Urban Contemporary"
        
        # Classic Refined: timeless, polished, traditional
        elif ('classic' in aesthetic or 'refined' in aesthetic or 'traditional' in aesthetic or
              'fitted' in silhouette or 'traditional' in silhouette or
              'business' in overall_style or 'polished' in overall_style):
            return "Classic Refined"
        
        # Fallback based on dominant characteristics
        else:
            # Create descriptive name from dominant attributes
            style_parts = []
            
            if aesthetic != 'unknown':
                style_parts.append(aesthetic.title())
            elif overall_style != 'unknown':
                style_parts.append(overall_style.title())
            else:
                style_parts.append('Contemporary')
            
            if silhouette != 'unknown' and silhouette in ['tailored', 'structured']:
                style_parts.append('Tailoring')
            elif silhouette != 'unknown' and silhouette in ['fluid', 'flowing', 'draped']:
                style_parts.append('Flow')
            elif fabrication != 'unknown':
                style_parts.append(fabrication.title())
            else:
                style_parts.append('Mix')
            
            return " ".join(style_parts[:2]) if len(style_parts) >= 2 else (style_parts[0] if style_parts else "Mixed Style")
    
    def _compute_statistics(
        self,
        vlt_records: List[Dict[str, Any]],
        clusters: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """Compute overall portfolio statistics"""
        # Aggregate statistics
        garment_types = defaultdict(int)
        all_colors = defaultdict(int)
        all_styles = defaultdict(int)
        
        for record in vlt_records:
            garment_types[record.get('garment_type', 'unknown')] += 1
            
            if 'colors' in record and 'primary' in record['colors']:
                all_colors[record['colors']['primary']] += 1
            
            if 'style' in record and 'overall' in record['style']:
                all_styles[record['style']['overall']] += 1
        
        return {
            'garment_distribution': dict(garment_types),
            'color_distribution': dict(all_colors),
            'style_distribution': dict(all_styles),
            'diversity_score': len(clusters) / len(vlt_records) if vlt_records else 0,
            'largest_cluster_percentage': max(c['percentage'] for c in clusters) if clusters else 0
        }
    
    def _compute_feature_importance(
        self,
        features: np.ndarray,
        feature_names: List[str],
        labels: np.ndarray
    ) -> Dict[str, float]:
        """Compute which features are most important for clustering"""
        from sklearn.ensemble import RandomForestClassifier
        
        if len(np.unique(labels)) < 2:
            return {}
        
        clf = RandomForestClassifier(n_estimators=50, random_state=42)
        clf.fit(features, labels)
        
        importance = dict(zip(feature_names, clf.feature_importances_))
        # Return top 10
        sorted_importance = sorted(importance.items(), key=lambda x: x[1], reverse=True)[:10]
        
        return dict(sorted_importance)
    
    def _save_profile(
        self,
        user_id: str,
        profile: Dict[str, Any],
        gmm: GaussianMixtureModel,
        scaler: StandardScaler,
        pca: PCA
    ):
        """Save profile and models to disk"""
        profile_path = os.path.join(self.models_dir, f"{user_id}_profile.joblib")
        models_path = os.path.join(self.models_dir, f"{user_id}_models.joblib")
        
        joblib.dump(profile, profile_path)
        joblib.dump({'gmm': gmm, 'scaler': scaler, 'pca': pca}, models_path)
        
        logger.info(f"Profile and models saved for {user_id}")
    
    def _load_models(self, user_id: str) -> tuple:
        """Load GMM, scaler, and PCA models"""
        models_path = os.path.join(self.models_dir, f"{user_id}_models.joblib")
        models = joblib.load(models_path)
        return models['gmm'], models['scaler'], models['pca']
    
    def _update_cluster_stats(
        self,
        existing_clusters: List[Dict[str, Any]],
        new_records: List[Dict[str, Any]],
        new_labels: np.ndarray,
        new_probabilities: np.ndarray,
        new_features: np.ndarray,
        feature_names: List[str]
    ) -> List[Dict[str, Any]]:
        """Update cluster statistics with new data (online learning)"""
        # This is a simplified update - in production you'd want more sophisticated online learning
        for cluster_id, cluster in enumerate(existing_clusters):
            new_cluster_mask = new_labels == cluster_id
            if new_cluster_mask.any():
                new_cluster_records = [r for i, r in enumerate(new_records) if new_cluster_mask[i]]
                cluster['size'] += len(new_cluster_records)
                # Recompute dominant attributes (simplified - should weight by existing data)
                cluster['dominant_attributes'] = self._find_dominant_attributes(new_cluster_records)
        
        return existing_clusters
    
    def _get_all_vlt_records(self, user_id: str) -> List[Dict[str, Any]]:
        """Fetch all VLT records for user from database"""
        # TODO: Implement database fetch
        # For now, return empty list - this should query the Node.js backend
        return []
    
    def is_ready(self) -> bool:
        """Check if service is ready"""
        return True


# Import already fixed at top of file

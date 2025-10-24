/**
 * Enhanced Style Profile Component
 * 
 * Shows rich, nuanced style information instead of just aggregated percentages
 */

import React from 'react';

export default function EnhancedStyleProfile({ styleProfile, ultraDetailedDescriptors }) {
  // Extract signature pieces (most detailed, high-confidence items)
  const signaturePieces = getSignaturePieces(ultraDetailedDescriptors);
  
  // Extract aesthetic themes
  const aestheticThemes = extractAestheticThemes(styleProfile, ultraDetailedDescriptors);
  
  // Extract construction preferences
  const constructionPrefs = extractConstructionPreferences(ultraDetailedDescriptors);
  
  return (
    <div className="enhanced-style-profile">
      {/* Executive Summary */}
      <section className="executive-summary">
        <h2>Your Style Signature</h2>
        <p className="style-description">{styleProfile.style_description}</p>
        
        <div className="aesthetic-tags">
          {aestheticThemes.map(theme => (
            <span key={theme.name} className="aesthetic-tag" style={{opacity: theme.strength}}>
              {theme.name}
            </span>
          ))}
        </div>
      </section>

      {/* Signature Pieces - The Good Stuff */}
      <section className="signature-pieces">
        <h3>Signature Pieces</h3>
        <p className="subtitle">The defining items in your wardrobe</p>
        
        <div className="pieces-grid">
          {signaturePieces.map(piece => (
            <div key={piece.id} className="signature-piece">
              <img src={piece.imageUrl} alt={piece.description} />
              
              <div className="piece-details">
                <h4>{piece.garment_type}</h4>
                <p className="one-liner">{piece.executive_summary}</p>
                
                <div className="key-attributes">
                  {piece.fabric && (
                    <div className="attribute">
                      <span className="label">Fabric:</span>
                      <span className="value">
                        {piece.fabric.primary_material}
                        {piece.fabric.texture && ` • ${piece.fabric.texture}`}
                        {piece.fabric.drape && ` • ${piece.fabric.drape} drape`}
                      </span>
                    </div>
                  )}
                  
                  {piece.construction && piece.construction.length > 0 && (
                    <div className="attribute">
                      <span className="label">Details:</span>
                      <span className="value">{piece.construction.join(', ')}</span>
                    </div>
                  )}
                  
                  {piece.colors && piece.colors.length > 0 && (
                    <div className="attribute">
                      <span className="label">Colors:</span>
                      <div className="color-swatches">
                        {piece.colors.map(color => (
                          <span 
                            key={color.name}
                            className="color-swatch"
                            style={{backgroundColor: color.hex || '#ccc'}}
                            title={`${color.name} (${color.coverage}%)`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {piece.aesthetic && (
                    <div className="attribute">
                      <span className="label">Vibe:</span>
                      <span className="value">{piece.aesthetic}</span>
                    </div>
                  )}
                </div>
                
                <div className="confidence-score">
                  <span className="score-label">Analysis Confidence:</span>
                  <div className="score-bar">
                    <div 
                      className="score-fill" 
                      style={{width: `${piece.confidence * 100}%`}}
                    />
                  </div>
                  <span className="score-value">{(piece.confidence * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Style Patterns - What Makes Your Style Yours */}
      <section className="style-patterns">
        <h3>Style Patterns</h3>
        
        <div className="patterns-grid">
          {/* Color Palette */}
          <div className="pattern-card">
            <h4>Color Palette</h4>
            <div className="color-analysis">
              {Object.entries(styleProfile.color_distribution || {})
                .slice(0, 5)
                .map(([color, freq]) => (
                  <div key={color} className="color-item">
                    <div className="color-info">
                      <span className="color-name">{color}</span>
                      <span className="color-freq">{(freq * 100).toFixed(0)}%</span>
                    </div>
                    <div className="freq-bar">
                      <div 
                        className="freq-fill" 
                        style={{width: `${freq * 100}%`, backgroundColor: getColorHex(color)}}
                      />
                    </div>
                  </div>
                ))}
            </div>
          </div>

          {/* Construction Preferences */}
          <div className="pattern-card">
            <h4>Construction Details You Love</h4>
            <ul className="construction-list">
              {constructionPrefs.map(pref => (
                <li key={pref.name}>
                  <span className="pref-name">{pref.name}</span>
                  <span className="pref-count">
                    {pref.count} {pref.count === 1 ? 'piece' : 'pieces'}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Silhouettes */}
          <div className="pattern-card">
            <h4>Preferred Silhouettes</h4>
            <div className="silhouette-chart">
              {Object.entries(styleProfile.silhouette_distribution || {})
                .slice(0, 5)
                .map(([silhouette, freq]) => (
                  <div key={silhouette} className="silhouette-item">
                    <span className="silhouette-name">{silhouette}</span>
                    <div className="silhouette-bar">
                      <div 
                        className="silhouette-fill" 
                        style={{width: `${freq * 100}%`}}
                      />
                    </div>
                    <span className="silhouette-freq">{(freq * 100).toFixed(0)}%</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Fabrics */}
          <div className="pattern-card">
            <h4>Fabric Preferences</h4>
            <div className="fabric-list">
              {Object.entries(styleProfile.fabric_distribution || {})
                .slice(0, 5)
                .map(([fabric, freq]) => (
                  <div key={fabric} className="fabric-item">
                    <span className="fabric-name">{fabric}</span>
                    <span className="fabric-freq">{(freq * 100).toFixed(0)}%</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </section>

      {/* Aesthetic Breakdown */}
      <section className="aesthetic-breakdown">
        <h3>Your Aesthetic DNA</h3>
        
        <div className="aesthetic-cards">
          {aestheticThemes.slice(0, 3).map(theme => (
            <div key={theme.name} className="aesthetic-card">
              <h4>{theme.name}</h4>
              <p className="theme-description">{theme.description}</p>
              
              <div className="theme-examples">
                <span className="examples-label">Seen in:</span>
                <ul>
                  {theme.examples.map((ex, i) => (
                    <li key={i}>{ex}</li>
                  ))}
                </ul>
              </div>
              
              <div className="theme-strength">
                <div className="strength-bar">
                  <div 
                    className="strength-fill" 
                    style={{width: `${theme.strength * 100}%`}}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// Helper functions

function getSignaturePieces(descriptors) {
  if (!descriptors || descriptors.length === 0) return [];
  
  // Filter for high-confidence, detailed pieces
  return descriptors
    .filter(d => 
      d.overall_confidence > 0.75 && 
      d.completeness_percentage > 70 &&
      d.garments && 
      d.garments.length > 0
    )
    .map(d => {
      const primaryGarment = d.garments[0];
      
      return {
        id: d.image_id,
        imageUrl: d.image_url,
        garment_type: primaryGarment.type,
        executive_summary: d.executive_summary?.one_sentence_description,
        fabric: primaryGarment.fabric,
        construction: [
          ...primaryGarment.construction?.seam_details || [],
          ...primaryGarment.construction?.closures || [],
          ...primaryGarment.construction?.hardware || []
        ].slice(0, 3),
        colors: primaryGarment.color_palette?.map(c => ({
          name: c.color_name,
          hex: c.hex_estimate,
          coverage: c.coverage_percentage
        })),
        aesthetic: d.contextual_attributes?.mood_aesthetic,
        confidence: d.overall_confidence,
        completeness: d.completeness_percentage
      };
    })
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 6); // Top 6 signature pieces
}

function extractAestheticThemes(styleProfile, descriptors) {
  const themes = new Map();
  
  descriptors.forEach(d => {
    const contextual = d.contextual_attributes || {};
    const styling = d.styling_context || {};
    
    // Collect aesthetic descriptors
    const aesthetics = [
      contextual.mood_aesthetic,
      contextual.style_tribe,
      styling.styling_approach
    ].filter(Boolean);
    
    aesthetics.forEach(aesthetic => {
      if (!themes.has(aesthetic)) {
        themes.set(aesthetic, {
          name: aesthetic,
          count: 0,
          examples: []
        });
      }
      
      const theme = themes.get(aesthetic);
      theme.count++;
      
      if (theme.examples.length < 3 && d.executive_summary?.key_garments) {
        theme.examples.push(d.executive_summary.key_garments[0]);
      }
    });
  });
  
  // Convert to array and add descriptions + strength scores
  return Array.from(themes.values())
    .map(theme => ({
      ...theme,
      strength: theme.count / descriptors.length,
      description: getAestheticDescription(theme.name)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function extractConstructionPreferences(descriptors) {
  const prefs = new Map();
  
  descriptors.forEach(d => {
    d.garments?.forEach(garment => {
      const construction = garment.construction || {};
      
      // Collect all construction details
      const details = [
        ...(construction.seam_details || []),
        ...(construction.closures || []),
        ...(construction.hardware || []),
        ...(construction.finishing || [])
      ];
      
      details.forEach(detail => {
        if (!prefs.has(detail)) {
          prefs.set(detail, { name: detail, count: 0 });
        }
        prefs.get(detail).count++;
      });
    });
  });
  
  return Array.from(prefs.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function getAestheticDescription(aesthetic) {
  const descriptions = {
    'minimalist': 'Clean lines, restrained palette, focus on quality and cut',
    'sporty-chic': 'Athletic influences elevated with sophisticated styling',
    'equestrian': 'Refined utility with equestrian-inspired details',
    'sophisticated': 'Polished, refined, and thoughtfully composed',
    'monochromatic': 'Unified color stories with tonal variation',
    'classic': 'Timeless pieces with enduring appeal',
    'contemporary': 'Modern interpretations of established silhouettes',
    'elevated casual': 'Relaxed pieces styled with intention'
  };
  
  return descriptions[aesthetic] || 'A distinctive element of your personal style';
}

function getColorHex(colorName) {
  const colorMap = {
    'black': '#000000',
    'white': '#FFFFFF',
    'navy': '#001F3F',
    'beige': '#F5F5DC',
    'gray': '#808080',
    'grey': '#808080',
    'charcoal': '#36454F',
    'cream': '#FFFDD0',
    'brown': '#654321',
    'tan': '#D2B48C'
  };
  
  return colorMap[colorName.toLowerCase()] || '#CCCCCC';
}

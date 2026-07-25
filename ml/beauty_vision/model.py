"""
Modelo propietario beauty-vision-1.

Arquitectura:
- Backbone: EfficientNet-B4 (pre-trained en ImageNet)
- Cabezales múltiples:
  * Subtono de piel (clasificación 3 clases)
  * Preocupaciones de piel (multi-label 6 clases)
  * Diagnóstico capilar (clasificación 4 atributos)
  * Morfología de manos (clasificación 4 clases)
  * Visajismo facial (regresión 5 landmarks)

Performance objetivo:
- Accuracy >90% en subtono de piel
- F1-score >0.85 en preocupaciones de piel
- Inferencia <200ms en GPU T4
"""

import torch
import torch.nn as nn
import torchvision.models as models
from typing import Dict, Tuple


class BeautyVisionModel(nn.Module):
    """Modelo multi-cabezal para análisis beauty integral."""
    
    def __init__(self, pretrained: bool = True):
        super().__init__()
        
        # Backbone: EfficientNet-B4
        self.backbone = models.efficientnet_b4(
            weights='DEFAULT' if pretrained else None
        )
        
        # Reemplazar classifier head
        feature_dim = self.backbone.classifier[1].in_features
        self.backbone.classifier = nn.Identity()
        
        # Cabezales específicos
        self.skin_subtone_head = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(feature_dim, 256),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(256, 3),  # cold, warm, neutral
        )
        
        self.skin_concerns_head = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(feature_dim, 512),
            nn.ReLU(),
            nn.Dropout(0.2),
            nn.Linear(512, 6),  # multi-label: acne, rosacea, etc.
        )
        
        self.hair_diagnosis_head = nn.ModuleDict({
            'porosity': nn.Sequential(
                nn.Linear(feature_dim, 128),
                nn.ReLU(),
                nn.Linear(128, 3),
            ),
            'damage_level': nn.Sequential(
                nn.Linear(feature_dim, 128),
                nn.ReLU(),
                nn.Linear(128, 4),
            ),
            'hair_type': nn.Sequential(
                nn.Linear(feature_dim, 128),
                nn.ReLU(),
                nn.Linear(128, 4),
            ),
            'density': nn.Sequential(
                nn.Linear(feature_dim, 128),
                nn.ReLU(),
                nn.Linear(128, 3),
            ),
        })
        
        self.hand_morphology_head = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(feature_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 4),  # hand_shape
        )
        
        self.brow_visajismo_head = nn.Sequential(
            nn.Dropout(0.3),
            nn.Linear(feature_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 5),  # face_shape + 4 proporciones
        )
        
        # Confidence heads (incertidumbre del modelo)
        self.confidence_head = nn.Sequential(
            nn.Linear(feature_dim, 64),
            nn.ReLU(),
            nn.Linear(64, 1),
            nn.Sigmoid(),
        )
    
    def forward(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """
        Forward pass multi-cabezal.
        
        Args:
            x: Tensor de imágenes [batch, channels, height, width]
        
        Returns:
            Dict con predicciones de cada cabezal
        """
        # Extraer features del backbone
        features = self.backbone(x)
        
        # Predicciones por cabezal
        outputs = {
            'skin_subtone': self.skin_subtone_head(features),
            'skin_concerns': torch.sigmoid(self.skin_concerns_head(features)),
            'hair_porosity': self.hair_diagnosis_head['porosity'](features),
            'hair_damage': self.hair_diagnosis_head['damage_level'](features),
            'hair_type': self.hair_diagnosis_head['hair_type'](features),
            'hair_density': self.hair_diagnosis_head['density'](features),
            'hand_shape': self.hand_morphology_head(features),
            'brow_visajismo': self.brow_visajismo_head(features),
            'confidence': self.confidence_head(features),
        }
        
        return outputs
    
    def get_param_count(self) -> int:
        """Retorna número total de parámetros entrenables."""
        return sum(p.numel() for p in self.parameters() if p.requires_grad)


class BeautyVisionEnsemble:
    """
    Ensemble de 3 modelos para mayor robustez.
    """
    
    def __init__(self, model_paths: list[str]):
        self.models = []
        for path in model_paths:
            model = BeautyVisionModel(pretrained=False)
            model.load_state_dict(torch.load(path, map_location='cpu'))
            model.eval()
            self.models.append(model)
    
    @torch.no_grad()
    def predict(self, x: torch.Tensor) -> Dict[str, torch.Tensor]:
        """Predicción por ensemble con votación ponderada."""
        all_outputs = [model(x) for model in self.models]
        
        # Promedio ponderado por confidence
        weights = torch.stack([out['confidence'] for out in all_outputs])
        weights = torch.softmax(weights, dim=0)
        
        ensemble_output = {}
        for key in all_outputs[0].keys():
            if key == 'confidence':
                ensemble_output[key] = weights.mean(dim=0)
            else:
                stacked = torch.stack([out[key] for out in all_outputs])
                ensemble_output[key] = (stacked * weights.unsqueeze(-1)).sum(dim=0)
        
        return ensemble_output

"""
Utility for converting georeferenced rasters to Leaflet-compatible WebP overlays.

This module provides functionality to convert GeoTIFF and other georeferenced
raster formats into transparent WebP images with EPSG:4326 bounds for use with
Leaflet's imageOverlay feature.
"""

import json
import subprocess
import logging
from pathlib import Path
from typing import Dict, List
from pyproj import Transformer, CRS
from config.main import ORTHO_DOWNSAMPLE_PERCENT

logger = logging.getLogger(__name__)


def _run(cmd: List[str], timeout: int = 3600) -> str:
    """
    Run a command and return stdout.
    
    Args:
        cmd: Command and arguments as a list
        timeout: Maximum time in seconds to wait (default: 3600 = 1 hour)
        
    Returns:
        Command stdout as string
        
    Raises:
        RuntimeError: If command fails
        subprocess.TimeoutExpired: If command times out
    """
    try:
        logger.debug(f"Running command: {' '.join(cmd)}")
        p = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        if p.returncode != 0:
            error_msg = p.stderr.strip() if p.stderr else "No error message"
            logger.error(f"Command failed with return code {p.returncode}")
            logger.error(f"STDOUT: {p.stdout}")
            logger.error(f"STDERR: {error_msg}")
            raise RuntimeError(f"Command failed: {' '.join(cmd)}\nReturn code: {p.returncode}\nSTDERR: {error_msg}\nSTDOUT: {p.stdout}")
        return p.stdout
    except subprocess.TimeoutExpired:
        raise RuntimeError(f"Command timed out after {timeout} seconds: {' '.join(cmd)}")


def raster_to_leaflet_overlay(
    input_path: str,
    output_webp: str,
) -> Dict[str, List[List[float]]]:
    """
    Convert a georeferenced raster into a transparent WebP and return Leaflet bounds.
    
    This function:
    1. Extracts bounds from the original raster (in native CRS)
    2. Transforms corner coordinates to EPSG:4326 (WGS84) for Leaflet
    3. Converts to WebP with alpha transparency (no reprojection)
    
    Note: The WebP will be in the original projection, but Leaflet bounds are in WGS84.
    This works well for most use cases and is much faster than full reprojection.
    WebP provides 25-35% smaller file sizes than PNG with same quality.
    
    Supported input formats:
    - GeoTIFF (.tif, .tiff)
    - JPG/PNG with world files (.jgw, .pgw, .wld)
    - Any GDAL-supported georeferenced raster
    
    Args:
        input_path: Path to input georeferenced raster file
        output_webp: Path where output WebP should be saved
        
    Returns:
        Dictionary with bounds in Leaflet format:
        {"bounds": [[south, west], [north, east]]}
        
    Raises:
        RuntimeError: If conversion fails or input has no georeferencing
        
    Example:
        >>> result = raster_to_leaflet_overlay("input.tif", "overlay.webp")
        >>> bounds = result["bounds"]
        >>> # Use in Leaflet: L.imageOverlay("/overlay.webp", bounds).addTo(map);
    """
    logger.info(f"Converting raster to Leaflet overlay: {input_path} -> {output_webp}")
    
    input_path = str(Path(input_path))
    output_webp = str(Path(output_webp))
    
    try:
        # Step 1: Get raster info and extract bounds in native CRS
        logger.info("Extracting bounds from georeferenced raster")
        info = json.loads(_run(["gdalinfo", "-json", input_path]))
        
        # Check for georeferencing
        corners = info.get("cornerCoordinates")
        if not corners:
            raise RuntimeError("Input raster has no georeferencing.")
        
        # Get corner coordinates in native CRS
        ul = corners["upperLeft"]  # [x, y] or [lon, lat]
        ur = corners["upperRight"]
        ll = corners["lowerLeft"]
        lr = corners["lowerRight"]
        
        # Get the source CRS
        wkt = info.get("coordinateSystem", {}).get("wkt")
        if not wkt:
            raise RuntimeError("Cannot determine coordinate system of input raster.")
        
        # Step 2: Transform corners to EPSG:4326 if needed
        logger.info("Transforming bounds to EPSG:4326")
        
        # Parse source CRS from WKT
        try:
            source_crs = CRS.from_wkt(wkt)
            target_crs = CRS.from_epsg(4326)
            
            # Check if already in WGS84
            if source_crs.to_epsg() == 4326:
                logger.info("Raster already in WGS84, using bounds directly")
                west, north = ul
                east, south = lr
            else:
                # Transform coordinates using pyproj
                logger.info(f"Transforming from {source_crs.name} to WGS84")
                transformer = Transformer.from_crs(source_crs, target_crs, always_xy=True)
                
                # Transform all four corners
                corners_native = [ul, ur, lr, ll]
                corners_wgs84 = []
                
                for corner in corners_native:
                    x, y = corner
                    lon, lat = transformer.transform(x, y)
                    corners_wgs84.append([lon, lat])
                
                # Extract bounds from transformed corners
                lons = [c[0] for c in corners_wgs84]
                lats = [c[1] for c in corners_wgs84]
                
                west = min(lons)
                east = max(lons)
                south = min(lats)
                north = max(lats)
        except Exception as e:
            raise RuntimeError(f"Failed to transform coordinates: {e}")
        
        bounds = [[south, west], [north, east]]
        logger.info(f"Extracted bounds: {bounds}")
        
        # Step 3: Convert to WebP with downsampling if needed
        # WebP provides 25-35% smaller file sizes than PNG with same quality
        # WebP has a maximum dimension limit of 16383x16383 pixels
        logger.info(f"Converting to WebP format")
        
        # Get original image dimensions
        width = info.get('size', [0, 0])[0]
        height = info.get('size', [0, 0])[1]
        logger.info(f"Source image dimensions: {width}x{height}")
        
        # Calculate dimensions after configured downsampling
        downsampled_width = int(width * ORTHO_DOWNSAMPLE_PERCENT / 100)
        downsampled_height = int(height * ORTHO_DOWNSAMPLE_PERCENT / 100)
        logger.info(f"After {ORTHO_DOWNSAMPLE_PERCENT}% downsampling: {downsampled_width}x{downsampled_height}")
        
        # WebP maximum dimensions are 16383x16383
        MAX_WEBP_DIM = 16383
        
        # For very large images, WebP encoder can hit partition size limits
        # even if dimensions are within limits. Be more conservative.
        # If image is close to the limit, downsample more aggressively
        SAFE_WEBP_DIM = 12000  # Conservative limit to avoid partition issues
        
        # Calculate final scale to fit within WebP limits
        final_scale_percent = ORTHO_DOWNSAMPLE_PERCENT
        
        # Check if we need additional downsampling
        if downsampled_width > SAFE_WEBP_DIM or downsampled_height > SAFE_WEBP_DIM:
            # Use conservative limit to avoid WebP partition size errors
            scale_for_width = SAFE_WEBP_DIM / width
            scale_for_height = SAFE_WEBP_DIM / height
            scale_factor = min(scale_for_width, scale_for_height)
            final_scale_percent = int(scale_factor * 100)
            
            final_width = int(width * final_scale_percent / 100)
            final_height = int(height * final_scale_percent / 100)
            
            logger.warning(f"Image exceeds safe WebP limits after {ORTHO_DOWNSAMPLE_PERCENT}% downsampling")
            logger.info(f"Applying {final_scale_percent}% downsampling to avoid WebP partition errors")
            logger.info(f"Final dimensions: {final_width}x{final_height}")
        elif downsampled_width > MAX_WEBP_DIM or downsampled_height > MAX_WEBP_DIM:
            # Still need to fit within absolute WebP limits
            scale_for_width = MAX_WEBP_DIM / width
            scale_for_height = MAX_WEBP_DIM / height
            scale_factor = min(scale_for_width, scale_for_height)
            final_scale_percent = int(scale_factor * 100)
            
            final_width = int(width * final_scale_percent / 100)
            final_height = int(height * final_scale_percent / 100)
            
            logger.warning(f"Image exceeds WebP dimension limits after {ORTHO_DOWNSAMPLE_PERCENT}% downsampling")
            logger.info(f"Applying {final_scale_percent}% downsampling to fit within WebP limits")
            logger.info(f"Final dimensions: {final_width}x{final_height}")
        else:
            logger.info(f"Image fits within WebP limits, using {ORTHO_DOWNSAMPLE_PERCENT}% downsampling")
        
        # Check if source has alpha band or nodata values
        has_alpha = info.get("bands", [{}])[-1].get("colorInterpretation") == "Alpha"
        nodata_value = info.get("bands", [{}])[0].get("noDataValue")
        
        # Build common gdal_translate options for WebP
        # WebP uses quality (0-100) instead of compression level
        # For very large images, reduce quality to avoid partition size errors
        # Quality 90 provides excellent quality with good compression
        # Quality 80 is still very good and helps with large images
        webp_quality = 80 if (final_width > 10000 or final_height > 10000) else 90
        
        common_options = [
            "gdal_translate",
            "-of", "WEBP",
            "-outsize", f"{final_scale_percent}%", "0",  # Downsample width, height auto-calculated
            "-co", f"QUALITY={webp_quality}",  # Adjust quality based on image size
            "-co", "LOSSLESS=NO",  # Use lossy compression for smaller files
        ]
        
        logger.info(f"Using WebP quality={webp_quality} for final dimensions {final_width}x{final_height}")
        
        if has_alpha:
            # Source already has alpha, just convert with downsampling
            logger.info("Source has alpha channel, converting with downsampling")
            _run(common_options + [input_path, output_webp], timeout=1800)  # 30 minute timeout for large files
        elif nodata_value is not None:
            # Source has nodata value, convert to alpha with downsampling
            logger.info(f"Source has nodata value ({nodata_value}), adding alpha channel with downsampling")
            _run(common_options + [
                "-b", "1",
                "-b", "2",
                "-b", "3",
                "-b", "mask",
                input_path,
                output_webp
            ], timeout=1800)
        else:
            # No nodata or alpha, convert as-is with downsampling
            logger.info("Source has no nodata or alpha, converting with downsampling")
            _run(common_options + [input_path, output_webp], timeout=1800)
        
        logger.info("Conversion completed successfully")
        
        return {"bounds": bounds}
        
    except Exception as e:
        logger.error(f"Failed to convert raster to Leaflet overlay: {e}")
        raise

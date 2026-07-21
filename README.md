# Chickpea Gene Expression Atlas v3.0

## Overview

The Chickpea Gene Expression Atlas v3.0 is an interactive web resource for exploring gene expression across 32 chickpea tissues and developmental stages.

The website integrates expression data, gene annotations, transcription-factor information, Gene Ontology terms, InterPro and Pfam annotations, marker genes, housekeeping candidates, and chromosome information.

## Main Features

- eFP-style gene expression atlas
- Gene expression bar plots
- Mean and median expression summaries
- Multi-gene heatmaps
- GWAS candidate gene search
- Transcription-factor portal
- Gene Ontology enrichment
- InterPro and Pfam enrichment
- Editable chromosome mapper
- Downloadable tables and figures

## Transcriptomic Dataset

RNA-seq data were obtained from:

**NCBI BioProject:** PRJNA622231

https://www.ncbi.nlm.nih.gov/bioproject/PRJNA622231

Reference:

Jain M, Bansal J, Rajkumar MS, Garg R. An integrated transcriptome mapping the regulatory network of coding and long non-coding RNAs provides a genomics resource in chickpea. *Communications Biology*. 2022;5:1106.

## Transcriptomic Analysis

The analysis workflow included:

1. Download of RNA-seq reads from NCBI SRA
2. Quality assessment using FastQC
3. Adapter and quality trimming using Trimmomatic
4. Transcript quantification using Salmon
5. Gene-level summarization using tximport
6. TPM matrix generation
7. Replicate summarization across tissues
8. Gene-expression classification
9. Tissue-specificity analysis
10. Marker-gene identification
11. TF-family analysis
12. GO enrichment
13. InterPro and Pfam enrichment

Gene expression was summarized across 32 tissues. Gene IDs were standardized where needed for integration across expression and annotation files.

## Enrichment Analysis

GO, InterPro, and Pfam enrichment analyses use:

- One-sided Fisher’s exact test
- Benjamini-Hochberg FDR correction
- FDR < 0.05
- Fold enrichment > 1
- At least three foreground genes
- At least five annotated genes in the tested set

Background genes are selected internally from genes in the expression atlas with the relevant annotation.

## Reference Genome

CDC Frontier chickpea reference genome and annotation resources were used.

https://data.legumeinfo.org/Cicer/arietinum/

## Development Team

### Shubh Pravat Singh Yadav

College of Agriculture  
Tennessee State University  
Nashville, Tennessee, USA

Email: sushantpy8500@gmail.com

GitHub:  
https://github.com/sushantpy8500

ORCID:  
https://orcid.org/0000-0003-3987-5616

### Kuber Shivashakarappa

College of Agriculture  
Tennessee State University  
Nashville, Tennessee, USA

Email: kshivash@my.tnstate.edu

## Faculty Advisors

### Dr. Lyle T. Wallace

College of Agriculture  
Tennessee State University

Email: lwalla10@tnstate.edu

### Dr. Ali Taheri

College of Agriculture  
Tennessee State University

Email: ali.taheri@tnstate.edu

## Repository Structure

```text
Chickpea-Gene-Expression-Atlas/
│
├── index.html
├── style.css
├── app.js
├── README.md
├── LICENSE
│
├── assets/
│   ├── atlas_logo.png
│   ├── Chickpea_gene_expression_atlas_RK.svg
│   └── team/
│       ├── Shubh.jpg
│       ├── Kuber.png
│       ├── Dr. Wallace.jpg
│       └── Dr. Taheri.jpg
│
└── data/
    ├── TPM_File_RK.csv
    ├── gene_annotation.csv
    ├── website_gene_master.csv
    ├── high_confidence_tissue_marker_genes.csv
    ├── candidate_housekeeping_genes.csv
    ├── GO_gene_mapping_with_terms.csv
    ├── combined_gene_domain_mapping.csv
    ├── interpro_pfam_domain_reference.csv
    └── chickpea_chromosome_lengths.csv

RK

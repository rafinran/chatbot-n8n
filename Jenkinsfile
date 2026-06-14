pipeline {
    agent any

    triggers {
        githubPush()
      }

    environment {
        APP_DIR       = '/home/rafinran/chatbot-n8n'
        COMPOSE_BASE  = "${APP_DIR}/docker-compose.yaml"
        COMPOSE_PROD  = "${APP_DIR}/docker-compose.prod.yaml"
        HEALTH_URL    = 'http://localhost/api/health'
        PATH          = "/usr/local/bin:/usr/bin:/bin:${env.PATH}"
    }

    options {
        timeout(time: 20, unit: 'MINUTES')
        disableConcurrentBuilds()
    }

    stages {
        // ── 1. Checkout ────────────────────────────────────────────────
        stage('Checkout') {
            steps {
                echo '📥 Pulling latest code...'
                checkout scm
            }
        }
        // ── 2. Dependency Audit ────────────────────────────────────────
        // stage('Dependency Audit') {
            // parallel {
            //     stage('Audit: Backend') {
            //         steps {
            //             dir('backend') {
            //                 echo '🔍 Auditing backend dependencies...'
            //                 sh 'npm ci --prefer-offline'
            //                 // --audit-level=high: hanya fail kalau ada vuln HIGH/CRITICAL
            //                 sh 'npm audit --audit-level=high || true'
            //             }
            //         }
            //     }
            //
            //     stage('Audit: Frontend') {
            //         steps {
            //             dir('frontend') {
            //                 echo '🔍 Auditing frontend dependencies...'
            //                 sh 'npm ci --prefer-offline'
            //                 sh 'npm audit --audit-level=high || true'
            //             }
            //         }
            //     }
            //
            //     stage('Audit: Indexer') {
            //         steps {
            //             dir('indexer') {
            //                 echo '🔍 Auditing Python dependencies...'
            //                 sh '''
            //                     python3 -m venv .venv
            //                     .venv/bin/pip install --quiet pip-audit
            //                     .venv/bin/pip-audit -r requirements.txt --severity high || true
        //                     '''
        //                 }
        //             }
        //         }
        //
        //     }
        // }
        //
        // ── 3. Lint ────────────────────────────────────────────────────
        // stage('Lint') {
        //     parallel {
        //         stage('Lint: Backend') {
        //             steps {
        //                 dir('backend') {
        //                     echo '🧹 Linting backend...'
        //                     // TypeScript type-check sebagai pengganti ESLint di backend
        //                     sh 'npx tsc --noEmit'
        //                 }
        //             }
        //         }
        //
        //         stage('Lint: Frontend') {
        //             steps {
        //                 dir('frontend') {
        //                     echo '🧹 Linting frontend...'
        //                     sh 'npm run lint'
        //                 }
        //             }
        //         }
        //
        //     }
        // }

        // ── 3. Test ───────────────────────────────────────────────────
        stage('Test') {
            steps {
                echo '🧪 Running backend tests...'
                dir('backend') {
                    sh 'npm ci --prefer-offline'
                    sh 'npm test'
                }
                echo '🧪 Running frontend tests...'
                dir('frontend') {
                    sh 'npm ci --prefer-offline'
                    sh 'npx vitest run'
                }
            }
        }

        // ── 4. Build Docker Images ─────────────────────────────────────
        stage('Build') {
            steps {
                echo '🐳 Building Docker images...'
                sh """rsync -av --exclude='.git' --exclude='node_modules' --exclude='rag/qdrant_storage' --exclude='rag/ollama' --exclude='rag/n8n_data' --exclude='backend/uploads' --exclude='backend/dist' --exclude='frontend/.next' . ${APP_DIR}/"""
                sh """cd ${APP_DIR} && docker compose -f ${COMPOSE_BASE} -f ${COMPOSE_PROD} build --no-cache"""
            }
        }

        // ── 5. Deploy ──────────────────────────────────────────────────
        stage('Deploy') {
            steps {
                echo '🚀 Deploying...'
                sh """
                    cd ${APP_DIR}
                    docker compose -f ${COMPOSE_BASE} -f ${COMPOSE_PROD} down --remove-orphans
                    docker compose -f ${COMPOSE_BASE} -f ${COMPOSE_PROD} up -d
                """
            }
        }

        // ── 6. Health Check ────────────────────────────────────────────
        stage('Health Check') {
            steps {
                echo '🏥 Waiting for services to be ready...'
                // Tunggu 20 detik buat containers fully up
                sh 'sleep 20'
                retry(3) {
                    sh """
                        STATUS=\$(curl -s -o /dev/null -w "%{http_code}" ${HEALTH_URL})
                        echo "Health check status: \$STATUS"
                        if [ "\$STATUS" != "200" ]; then
                            echo "❌ Health check failed (HTTP \$STATUS)"
                            exit 1
                        fi
                        echo "✅ Health check passed"
                    """
                }
            }
        }

        // ── 7. Cleanup ─────────────────────────────────────────────────
        stage('Cleanup') {
            steps {
                echo '🧼 Removing dangling images...'
                sh 'docker image prune -f'
            }
        }

    }

    post {
        success {
            echo '✅ Pipeline berhasil! Aplikasi sudah ter-deploy.'
        }
        failure {
            echo '❌ Pipeline gagal. Cek logs di atas.'
        }
        always {
            cleanWs()
        }
    }
}

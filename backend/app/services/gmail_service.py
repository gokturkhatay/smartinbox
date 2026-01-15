import os
import base64
import json
from typing import Optional, List, Dict, Any
from datetime import datetime
from email.utils import parsedate_to_datetime

from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build


# Gmail API Scopes
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.modify',
    'https://www.googleapis.com/auth/gmail.send'
]

# Path to credentials
CREDENTIALS_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'credentials.json')
TOKEN_PATH = os.path.join(os.path.dirname(__file__), '..', '..', 'token.json')


class GmailService:
    """Service for interacting with Gmail API"""
    
    def __init__(self):
        self.creds: Optional[Credentials] = None
        self.service = None
        self._load_credentials()
    
    def _load_credentials(self):
        """Load saved credentials if they exist"""
        if os.path.exists(TOKEN_PATH):
            with open(TOKEN_PATH, 'r') as token_file:
                token_data = json.load(token_file)
                self.creds = Credentials.from_authorized_user_info(token_data, SCOPES)
        
        # Refresh if expired
        if self.creds and self.creds.expired and self.creds.refresh_token:
            try:
                self.creds.refresh(Request())
                self._save_credentials()
            except Exception:
                self.creds = None
        
        if self.creds and self.creds.valid:
            self.service = build('gmail', 'v1', credentials=self.creds)
    
    def _save_credentials(self):
        """Save credentials to file"""
        if self.creds:
            with open(TOKEN_PATH, 'w') as token_file:
                token_file.write(self.creds.to_json())
    
    def is_authenticated(self) -> bool:
        """Check if user is authenticated - reloads credentials if needed"""
        # Reload credentials from file to ensure we have the latest token
        if os.path.exists(TOKEN_PATH):
            try:
                with open(TOKEN_PATH, 'r') as token_file:
                    token_data = json.load(token_file)
                    self.creds = Credentials.from_authorized_user_info(token_data, SCOPES)
                
                # Refresh if expired
                if self.creds and self.creds.expired and self.creds.refresh_token:
                    try:
                        self.creds.refresh(Request())
                        self._save_credentials()
                    except Exception as e:
                        print(f"Token refresh error: {e}")
                        self.creds = None
                
                # Rebuild service if credentials are valid
                if self.creds and self.creds.valid:
                    if not self.service:
                        self.service = build('gmail', 'v1', credentials=self.creds)
                    return True
            except Exception as e:
                print(f"Error loading credentials: {e}")
                self.creds = None
                self.service = None
        
        return False
    
    def get_auth_url(self, redirect_uri: str) -> str:
        """Get OAuth2 authorization URL"""
        if not os.path.exists(CREDENTIALS_PATH):
            raise FileNotFoundError("credentials.json not found")
        
        flow = Flow.from_client_secrets_file(
            CREDENTIALS_PATH,
            scopes=SCOPES,
            redirect_uri=redirect_uri
        )
        
        authorization_url, _ = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent'
        )
        
        return authorization_url
    
    def authenticate(self, code: str, redirect_uri: str) -> bool:
        """Complete OAuth2 flow with authorization code"""
        try:
            if not os.path.exists(CREDENTIALS_PATH):
                raise FileNotFoundError("credentials.json not found")
            
            flow = Flow.from_client_secrets_file(
                CREDENTIALS_PATH,
                scopes=SCOPES,
                redirect_uri=redirect_uri
            )
            
            flow.fetch_token(code=code)
            self.creds = flow.credentials
            self._save_credentials()
            
            if self.creds and self.creds.valid:
                self.service = build('gmail', 'v1', credentials=self.creds)
                return True
            return False
        except Exception as e:
            print(f"Authentication error: {e}")
            return False
    
    def logout(self):
        """Logout and clear credentials"""
        self.creds = None
        self.service = None

        if os.path.exists(TOKEN_PATH):
            os.remove(TOKEN_PATH)
    
    def get_user_profile(self) -> Optional[Dict[str, Any]]:
        """Get user's Gmail profile"""
        if not self.service:
            return None
        
        try:
            profile = self.service.users().getProfile(userId='me').execute()
            return {
                "email": profile.get('emailAddress'),
                "messages_total": profile.get('messagesTotal'),
                "threads_total": profile.get('threadsTotal')
            }
        except Exception as e:
            print(f"Error getting profile: {e}")
            return None
    
    def fetch_emails(self, max_results: int = 50, query: str = None, page_token: str = None) -> Dict[str, Any]:
        """Fetch emails from Gmail using batch requests for speed"""
        if not self.service:
            return {"emails": [], "next_page_token": None}

        try:
            # Build query
            params = {
                'userId': 'me',
                'maxResults': max_results,
                'labelIds': ['INBOX']
            }

            if query:
                params['q'] = query
            if page_token:
                params['pageToken'] = page_token

            # Get message list (just IDs)
            results = self.service.users().messages().list(**params).execute()
            messages = results.get('messages', [])
            next_page_token = results.get('nextPageToken')

            if not messages:
                return {"emails": [], "next_page_token": next_page_token}

            # Batch fetch all message details at once (MUCH faster!)
            emails = self._batch_get_emails([msg['id'] for msg in messages])

            return {
                "emails": emails,
                "next_page_token": next_page_token
            }

        except Exception as e:
            print(f"Error fetching emails: {e}")
            return {"emails": [], "next_page_token": None}

    def _batch_get_emails(self, message_ids: List[str], batch_size: int = 25) -> List[Dict[str, Any]]:
        """Batch fetch multiple emails - using smaller batches to avoid rate limits"""
        import time as time_module

        if not self.service or not message_ids:
            return []

        all_emails = []
        total_batches = (len(message_ids) + batch_size - 1) // batch_size

        # Process in batches of 25 (Gmail concurrent request limit)
        for i in range(0, len(message_ids), batch_size):
            batch_ids = message_ids[i:i + batch_size]
            batch_num = i // batch_size + 1

            # Use a class to hold batch results (avoids closure issues)
            class BatchResults:
                def __init__(self, parser):
                    self.emails = []
                    self.errors = []
                    self.parser = parser

                def callback(self, request_id, response, exception):
                    if exception:
                        self.errors.append(str(exception))
                    else:
                        email_data = self.parser(response)
                        if email_data:
                            self.emails.append(email_data)

            results = BatchResults(self._parse_message)

            # Create batch request
            batch = self.service.new_batch_http_request(callback=results.callback)

            for msg_id in batch_ids:
                batch.add(
                    self.service.users().messages().get(
                        userId='me',
                        id=msg_id,
                        format='full'
                    )
                )

            # Execute batch with retry on rate limit
            max_retries = 2
            for retry in range(max_retries + 1):
                try:
                    batch.execute()
                    break
                except Exception as e:
                    if retry < max_retries and '429' in str(e):
                        time_module.sleep(1)
                        continue
                    raise

            # Log errors only if significant
            if results.errors and len(results.errors) > len(batch_ids) // 2:
                print(f"Batch {batch_num}/{total_batches}: {len(results.errors)} errors")

            all_emails.extend(results.emails)

            # Delay between batches to respect rate limits
            if i + batch_size < len(message_ids):
                time_module.sleep(0.5)

        return all_emails

    def _parse_message(self, message: Dict) -> Optional[Dict[str, Any]]:
        """Parse a Gmail message into our email format"""
        try:
            # Extract headers
            headers = message.get('payload', {}).get('headers', [])
            subject = next((h['value'] for h in headers if h['name'].lower() == 'subject'), '')
            sender = next((h['value'] for h in headers if h['name'].lower() == 'from'), '')
            recipient = next((h['value'] for h in headers if h['name'].lower() == 'to'), '')

            # Parse sender name
            sender_name = sender
            if '<' in sender:
                sender_name = sender.split('<')[0].strip().strip('"')
                sender = sender.split('<')[1].strip('>')

            # Get date
            date_str = next((h['value'] for h in headers if h['name'].lower() == 'date'), None)
            date = datetime.utcnow()
            if date_str:
                try:
                    date = parsedate_to_datetime(date_str)
                except:
                    date = datetime.utcnow()

            # Get body
            body = self._extract_body(message.get('payload', {}))

            return {
                "gmail_id": message['id'],
                "thread_id": message.get('threadId'),
                "subject": subject,
                "sender": sender,
                "sender_name": sender_name,
                "recipient": recipient,
                "snippet": message.get('snippet', ''),
                "body": body,
                "received_at": date.isoformat() if date else datetime.utcnow().isoformat(),
                "is_read": 'UNREAD' not in message.get('labelIds', []),
                "gmail_labels": message.get('labelIds', [])
            }

        except Exception as e:
            print(f"Error parsing message: {e}")
            return None
    
    def _get_email_details(self, message_id: str) -> Optional[Dict[str, Any]]:
        """Get full details of a specific email (single fetch)"""
        if not self.service:
            return None

        try:
            message = self.service.users().messages().get(
                userId='me',
                id=message_id,
                format='full'
            ).execute()
            return self._parse_message(message)
        except Exception as e:
            print(f"Error getting email details: {e}")
            return None
    
    def _extract_body(self, payload: Dict) -> str:
        """Extract email body from payload - prefer HTML over plain text"""
        html_body = ""
        plain_body = ""
        
        if 'body' in payload and payload['body'].get('data'):
            decoded = base64.urlsafe_b64decode(payload['body']['data']).decode('utf-8', errors='ignore')
            mime_type = payload.get('mimeType', '')
            if mime_type == 'text/html':
                html_body = decoded
            else:
                plain_body = decoded
        
        elif 'parts' in payload:
            # First pass: collect HTML and plain text separately
            for part in payload['parts']:
                mime_type = part.get('mimeType', '')
                
                if mime_type == 'text/html':
                    if part.get('body', {}).get('data'):
                        html_body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8', errors='ignore')
                elif mime_type == 'text/plain':
                    if part.get('body', {}).get('data'):
                        plain_body = base64.urlsafe_b64decode(part['body']['data']).decode('utf-8', errors='ignore')
                elif 'parts' in part:
                    # Recursive call for nested parts
                    nested_result = self._extract_body(part)
                    if nested_result:
                        if not html_body and '<' in nested_result:
                            html_body = nested_result
                        elif not plain_body:
                            plain_body = nested_result
        
        # Prefer HTML over plain text
        body = html_body if html_body else plain_body
        
        # Increase limit for HTML emails (they can be longer)
        max_length = 50000 if html_body else 5000
        return body[:max_length] if body else ""
    
    def mark_as_read(self, message_id: str) -> bool:
        """Mark email as read"""
        if not self.service:
            return False
        
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'removeLabelIds': ['UNREAD']}
            ).execute()
            return True
        except Exception:
            return False
    
    def mark_as_unread(self, message_id: str) -> bool:
        """Mark email as unread"""
        if not self.service:
            return False
        
        try:
            self.service.users().messages().modify(
                userId='me',
                id=message_id,
                body={'addLabelIds': ['UNREAD']}
            ).execute()
            return True
        except Exception:
            return False
    
    def star_email(self, message_id: str, star: bool = True) -> bool:
        """Star or unstar an email"""
        if not self.service:
            return False
        
        try:
            if star:
                self.service.users().messages().modify(
                    userId='me',
                    id=message_id,
                    body={'addLabelIds': ['STARRED']}
                ).execute()
            else:
                self.service.users().messages().modify(
                    userId='me',
                    id=message_id,
                    body={'removeLabelIds': ['STARRED']}
                ).execute()
            return True
        except Exception:
            return False
    
    def delete_email(self, message_id: str) -> bool:
        """Delete an email from Gmail"""
        if not self.service:
            return False
        
        try:
            self.service.users().messages().delete(
                userId='me',
                id=message_id
            ).execute()
            return True
        except Exception as e:
            print(f"Error deleting email from Gmail: {e}")
            return False
    
    def send_email(self, to: str, subject: str, body: str, reply_to_message_id: Optional[str] = None) -> Optional[str]:
        """Send an email via Gmail API"""
        if not self.service:
            return None
        
        try:
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            # Create message
            message = MIMEMultipart('alternative')
            message['to'] = to
            message['subject'] = subject
            
            # Get user's email for From field
            profile = self.get_user_profile()
            if profile:
                message['from'] = profile.get('email', '')
            
            # If replying, set In-Reply-To and References headers
            if reply_to_message_id:
                try:
                    original = self.service.users().messages().get(userId='me', id=reply_to_message_id).execute()
                    headers = original.get('payload', {}).get('headers', [])
                    msg_id = next((h['value'] for h in headers if h['name'].lower() == 'message-id'), None)
                    if msg_id:
                        message['In-Reply-To'] = msg_id
                        message['References'] = msg_id
                except:
                    pass
            
            # Add body
            text_part = MIMEText(body, 'plain')
            message.attach(text_part)
            
            # Encode message
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode('utf-8')
            
            # Prepare message body
            message_body = {'raw': raw_message}
            if reply_to_message_id:
                try:
                    original = self.service.users().messages().get(userId='me', id=reply_to_message_id).execute()
                    thread_id = original.get('threadId')
                    if thread_id:
                        message_body['threadId'] = thread_id
                except:
                    pass
            
            # Send message
            sent_message = self.service.users().messages().send(
                userId='me',
                body=message_body
            ).execute()
            
            return sent_message.get('id')
        
        except Exception as e:
            print(f"Error sending email: {e}")
            return None


# Global instance
gmail_service = GmailService()
